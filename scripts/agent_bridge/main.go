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
//	    {"name":"flomaster","provider":"openai-api","runtime":"flomaster","avatar":"\U0001f9e0","source_dir":"~/.flomaster","found":true,"core":true,"status":"offline"}
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
	"time"
)

type Agent struct {
	Name       string `json:"name"`
	Provider   string `json:"provider"`
	Runtime    string `json:"runtime"`
	Avatar     string `json:"avatar"`
	SourceDir  string `json:"source_dir"`
	Found      bool   `json:"found"`
	Core       bool   `json:"core"`
	Status     string `json:"status"`
}

var agentDefs = []Agent{
	{Name: "flomaster", Provider: "openai-api", Runtime: "flomaster", Avatar: "\U0001f9e0", SourceDir: "~/.flomaster", Core: true},
	{Name: "hermes", Provider: "openrouter", Runtime: "hermes", Avatar: "\U0001f426", SourceDir: "~/.hermes", Core: true},
	{Name: "agents-hub", Provider: "mixed", Runtime: "hub", Avatar: "\U0001f9f0", SourceDir: "~/.agents", Core: true},
	{Name: "cursor", Provider: "openai", Runtime: "cursor", Avatar: "\U0001f5b1", SourceDir: "~/.cursor", Core: false},
	{Name: "pi", Provider: "inflection", Runtime: "pi", Avatar: "\U0001f967", SourceDir: "~/.pi", Core: false},
}

type payload struct {
	Host       string  `json:"host"`
	ScannedAt  string  `json:"scanned_at"`
	Agents     []Agent `json:"agents"`
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
	for _, a := range agentDefs {
		a.Found = dirExists(filepath.Join(homeDir, filepath.Base(a.SourceDir)))
		a.Status = "offline"
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

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "agent-bridge error: "+format+"\n", args...)
	os.Exit(1)
}
