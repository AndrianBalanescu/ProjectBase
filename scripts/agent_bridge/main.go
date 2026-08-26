// ProjectBase agent-bridge (sidecar, Go).
//
// Scans this machine's local AI agents and writes a SANITIZED metadata JSON that
// the ProjectBase server (which runs under its own locked-down system user) can
// read. NEVER forwards secrets: auth.json / memrize.db / credentials stay local.
//
// Why: the PB systemd service runs as a dedicated user with ProtectHome=read-only,
// so it cannot read ~ubuntu (700). This bridge runs AS the machine user, reads
// their agent dirs, and publishes only public metadata to a world-readable JSON.
//
// Build (single static binary, zero runtime deps):
//
//	cd scripts/agent_bridge && go build -o ../../bin/agent_bridge .
//
// Run:
//
//	bin/agent_bridge --out /run/projectbase/agents.json
//
// Output schema (sanitized, never secrets):
//
//	{
//	  "host": "<hostname>",
//	  "scanned_at": "<iso8601>",
//	  "agents": [
//	    {"name":"flomaster","provider":"openai-api","runtime":"flomaster","avatar":"\U0001f9e0","source_dir":"~/.flomaster","found":true,"core":true,"status":"online","session_count":2}
//	  ],
//	  "sessions": [
//	    {"agent":"flomaster","id":"...","short_name":"panda","title":"...","status":"Active","model":"...","working_dir":"...","last_active_at":"...","updated_at":"...","intention":"...","message_count":768,"avatar":"\U0001f9e0"}
//	  ]
//	}
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type Agent struct {
	Name         string `json:"name"`
	Provider     string `json:"provider"`
	Runtime      string `json:"runtime"`
	Avatar       string `json:"avatar"`
	SourceDir    string `json:"source_dir"`
	Found        bool   `json:"found"`
	Core         bool   `json:"core"`
	Status       string `json:"status"`
	SessionCount int    `json:"session_count,omitempty"`
}

// Session is a lightweight, sanitized view of one flomaster session. It carries
// only public metadata + a short intent/plan line, never message bodies or
// secrets.
type Session struct {
	Agent        string `json:"agent"`
	ID           string `json:"id"`
	ShortName    string `json:"short_name"`
	Title        string `json:"title"`
	Status       string `json:"status"`
	Model        string `json:"model"`
	WorkingDir   string `json:"working_dir"`
	LastActiveAt string `json:"last_active_at"`
	UpdatedAt    string `json:"updated_at"`
	Intention    string `json:"intention"`
	MessageCount int    `json:"message_count"`
	Avatar       string `json:"avatar"`
}

var agentDefs = []Agent{
	{Name: "flomaster", Provider: "openai-api", Runtime: "flomaster", Avatar: "\U0001f9e0", SourceDir: "~/.flomaster", Core: true},
	{Name: "hermes", Provider: "openrouter", Runtime: "hermes", Avatar: "\U0001f426", SourceDir: "~/.hermes", Core: true},
	{Name: "agents-hub", Provider: "mixed", Runtime: "hub", Avatar: "\U0001f9f0", SourceDir: "~/.agents", Core: true},
	{Name: "cursor", Provider: "openai", Runtime: "cursor", Avatar: "\U0001f5b1", SourceDir: "~/.cursor", Core: false},
	{Name: "pi", Provider: "inflection", Runtime: "pi", Avatar: "\U0001f967", SourceDir: "~/.pi", Core: false},
}

type payload struct {
	Host      string    `json:"host"`
	ScannedAt string    `json:"scanned_at"`
	Agents    []Agent   `json:"agents"`
	Sessions  []Session `json:"sessions"`
}

// home resolves the real home dir of the running user, regardless of the
// (possibly locked-down) HOME env set by the calling environment.
func home() string {
	if u, err := user.Current(); err == nil && u.HomeDir != "" {
		if fi, err := os.Stat(u.HomeDir); err == nil && fi.IsDir() {
			return u.HomeDir
		}
	}
	for _, cand := range []string{"/home/ubuntu", "/home/admin", "/root"} {
		if fi, err := os.Stat(cand); err == nil && fi.IsDir() {
			return cand
		}
	}
	return "/home/ubuntu"
}

func main() {
	out := flag.String("out", "/run/projectbase/agents.json", "output JSON path")
	flag.Parse()

	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "unknown"
	}

	homeDir := home()
	agents := make([]Agent, 0, len(agentDefs))
	sessions := []Session{}
	for _, a := range agentDefs {
		base := filepath.Base(a.SourceDir)
		a.Found = dirExists(filepath.Join(homeDir, base))
		a.Status = "offline"
		// flomaster sessions are the live, human-readable proof of "what the
		// agent is working on right now".
		if a.Name == "flomaster" && a.Found {
			s := collectSessions(filepath.Join(homeDir, base, "sessions"), a.Avatar)
			a.SessionCount = len(s)
			if a.SessionCount > 0 {
				a.Status = "online"
			}
			sessions = append(sessions, s...)
		}
		agents = append(agents, a)
	}
	sort.Slice(agents, func(i, j int) bool {
		if agents[i].Core != agents[j].Core {
			return agents[i].Core // core first
		}
		return agents[i].Name < agents[j].Name
	})

	data, err := json.MarshalIndent(payload{
		Host:      hostname,
		ScannedAt: time.Now().UTC().Format(time.RFC3339),
		Agents:    agents,
		Sessions:  sessions,
	}, "", "  ")
	if err != nil {
		fail("marshal: %v", err)
	}

	if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
		fail("mkdir %s: %v", filepath.Dir(*out), err)
	}
	if err := os.WriteFile(*out, data, 0o644); err != nil {
		fail("write %s: %v", *out, err)
	}
	fmt.Printf("wrote %d agent(s) to %s\n", len(agents), *out)
}

func dirExists(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && fi.IsDir()
}

// collectSessions scans a flomaster sessions dir and returns the most recent,
// sanitized sessions (public metadata only). It reads the .json snapshots and,
// for each, a tiny -plan.json sibling that carries the user's current intent
// line. Message bodies are never read into the output.
func collectSessions(dir, avatar string) []Session {
	ents, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	type cand struct {
		base string
		m    int64
	}
	var cands []cand
	for _, e := range ents {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, "session_") || !strings.HasSuffix(name, ".json") {
			continue
		}
		// skip journals + backups; only the primary .json snapshot
		if strings.Contains(name, ".journal.jsonl") || strings.HasSuffix(name, ".bak") {
			continue
		}
		// accept only the canonical session_<name>_<ts>_<id>.json (no suffix like -plan/-goals)
		base := strings.TrimSuffix(name, ".json")
		if strings.Contains(base, "-plan") || strings.Contains(base, "-goals") ||
			strings.Contains(base, "-review-state") || strings.Contains(base, "-gate-observations") {
			continue
		}
		if fi, err := e.Info(); err == nil {
			cands = append(cands, cand{base: name, m: fi.ModTime().Unix()})
		}
	}
	// newest first, cap at 8 sessions
	sort.Slice(cands, func(i, j int) bool { return cands[i].m > cands[j].m })
	if len(cands) > 8 {
		cands = cands[:8]
	}
	sessionsDir := dir
	todosDir := filepath.Join(filepath.Dir(dir), "todos")

	out := make([]Session, 0, len(cands))
	for _, c := range cands {
		s := parseSessionJSON(filepath.Join(sessionsDir, c.base), avatar)
		if s.ID == "" {
			continue
		}
		// pull the intent line from the matching -plan.json sibling (tiny file)
		base := strings.TrimSuffix(c.base, ".json")
		planPath := filepath.Join(todosDir, base+"-plan.json")
		if b, err := os.ReadFile(planPath); err == nil {
			var pl struct {
				UserIntention string `json:"user_intention"`
			}
			if json.Unmarshal(b, &pl) == nil && pl.UserIntention != "" {
				s.Intention = pl.UserIntention
			}
		}
		out = append(out, s)
	}
	return out
}

// parseSessionJSON reads one session snapshot. It is intentionally tolerant:
// malformed/missing fields fall back to empty strings.
func parseSessionJSON(path, avatar string) Session {
	b, err := os.ReadFile(path)
	if err != nil {
		return Session{}
	}
	var raw struct {
		ID           string        `json:"id"`
		Title        string        `json:"title"`
		Status       string        `json:"status"`
		Model        string        `json:"model"`
		WorkingDir   string        `json:"working_dir"`
		ShortName    string        `json:"short_name"`
		LastActiveAt string        `json:"last_active_at"`
		UpdatedAt    string        `json:"updated_at"`
		Messages     []interface{} `json:"messages"`
	}
	if json.Unmarshal(b, &raw) != nil {
		return Session{}
	}
	if raw.ID == "" && raw.ShortName == "" {
		return Session{}
	}
	return Session{
		Agent:        "flomaster",
		ID:           raw.ID,
		ShortName:    raw.ShortName,
		Title:        raw.Title,
		Status:       raw.Status,
		Model:        raw.Model,
		WorkingDir:   raw.WorkingDir,
		LastActiveAt: raw.LastActiveAt,
		UpdatedAt:    raw.UpdatedAt,
		MessageCount: len(raw.Messages),
		Avatar:       avatar,
	}
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "agent-bridge error: "+format+"\n", args...)
	os.Exit(1)
}
