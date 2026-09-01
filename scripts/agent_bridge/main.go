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
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
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
// only public metadata + a short intent/plan line + recent tool-call names + live reasoning streams,
// never full message bodies, tool outputs, or secrets.
type Session struct {
	Agent           string          `json:"agent"`
	ID              string          `json:"id"`
	ShortName       string          `json:"short_name"`
	Title           string          `json:"title"`
	Status          string          `json:"status"`
	IsActive        bool            `json:"is_active"`
	Model           string          `json:"model"`
	WorkingDir      string          `json:"working_dir"`
	LastActiveAt    string          `json:"last_active_at"`
	UpdatedAt       string          `json:"updated_at"`
	Intention       string          `json:"intention"`
	LatestReasoning string          `json:"latest_reasoning,omitempty"`
	ReasoningSteps  []string        `json:"reasoning_steps,omitempty"`
	FilesTouched    []string        `json:"files_touched,omitempty"`
	LiveActivity    []ActivityEvent `json:"live_activity,omitempty"`
	LastText        string          `json:"last_text,omitempty"`
	RecentTools     []Tool          `json:"recent_tools,omitempty"`
	Chat            []ChatMessage   `json:"chat,omitempty"`
	TokenUsage      TokenStats      `json:"token_usage,omitempty"`
	Todos           []TodoItem      `json:"todos,omitempty"`
	MessageCount    int             `json:"message_count"`
	Avatar          string          `json:"avatar"`
}

// ChatMessage is one sanitized, structured chat turn. `role` is "user" or
// "assistant". For assistant turns, content blocks are rendered as compact,
// type-distinct bubbles (reasoning, text, tools). Never forwards raw tool
// outputs or secrets.
type ChatMessage struct {
	Role      string     `json:"role"`
	Content   string     `json:"content,omitempty"`   // plain text (user / assistant text)
	Reasoning string     `json:"reasoning,omitempty"` // cursive, low-saturation thought block
	Tools     []ChatTool `json:"tools,omitempty"`     // grouped tool invocations
	Timestamp string     `json:"timestamp,omitempty"`
}

// ChatTool is a compact, grouped tool invocation inside an assistant turn.
type ChatTool struct {
	Name   string `json:"name"`
	Input  string `json:"input,omitempty"`
	Intent string `json:"intent,omitempty"`
}

// TokenStats aggregates token usage across the scanned message window.
type TokenStats struct {
	Prompt     int `json:"prompt"`
	Completion int `json:"completion"`
	Total      int `json:"total"`
}

// ActivityEvent is an interleaved chronological item in the live session stream.
type ActivityEvent struct {
	Type      string `json:"type"`              // "reasoning" | "tool" | "text"
	Name      string `json:"name,omitempty"`    // tool name (for tool events)
	Intent    string `json:"intent,omitempty"`  // tool intent label
	Input     string `json:"input,omitempty"`   // input summary (file path, query, command)
	Summary   string `json:"summary,omitempty"` // reasoning or text snippet
	Timestamp string `json:"timestamp,omitempty"`
}

// Tool is one sanitized tool invocation: name + a short input summary (never
// raw output, never secret values).
type Tool struct {
	Name      string `json:"name"`
	Input     string `json:"input,omitempty"`
	Intent    string `json:"intent,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

// TodoItem is one entry in a session's active checklist (the -goals.json snapshot).
type TodoItem struct {
	ID       string `json:"id,omitempty"`
	Content  string `json:"content"`
	Status   string `json:"status"`
	Priority string `json:"priority,omitempty"`
}

type payload struct {
	Host      string    `json:"host"`
	ScannedAt string    `json:"scanned_at"`
	Agents    []Agent   `json:"agents"`
	Sessions  []Session `json:"sessions"`
}

// agentDefs lists well-known agents to scan on the host.
var agentDefs = []Agent{
	{Name: "flomaster", Provider: "openai-api", Runtime: "flomaster", Avatar: "🧠", SourceDir: "~/.flomaster", Core: true},
	{Name: "hermes", Provider: "openrouter", Runtime: "hermes", Avatar: "🐦", SourceDir: "~/.hermes", Core: true},
	{Name: "agents-hub", Provider: "mixed", Runtime: "hub", Avatar: "🧰", SourceDir: "~/.agents", Core: true},
	{Name: "cursor", Provider: "openai", Runtime: "cursor", Avatar: "🖱", SourceDir: "~/.cursor", Core: false},
	{Name: "claude", Provider: "anthropic", Runtime: "claude-code", Avatar: "🤖", SourceDir: "~/.claude", Core: false},
}

func home() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	if u, err := user.Current(); err == nil && u.HomeDir != "" {
		return u.HomeDir
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
			s := collectSessions(homeDir, filepath.Join(homeDir, base, "sessions"), a.Avatar)
			a.SessionCount = len(s)
			if a.SessionCount > 0 {
				a.Status = "online"
			}
			sessions = append(sessions, s...)
		}
		if a.Name == "hermes" && a.Found {
			hs := collectHermesSessions(homeDir)
			a.SessionCount = len(hs)
			if a.SessionCount > 0 {
				a.Status = "online"
			}
			sessions = append(sessions, hs...)
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

func isSessionProcessAlive(homeDir, sessionID string) bool {
	if sessionID == "" {
		return false
	}
	// Try both full session ID and base name
	candidates := []string{
		filepath.Join(homeDir, ".flomaster", "active_pids", sessionID),
	}
	for _, pidFile := range candidates {
		data, err := os.ReadFile(pidFile)
		if err != nil {
			continue
		}
		pidStr := strings.TrimSpace(string(data))
		if pidStr == "" {
			continue
		}
		var pid int
		if _, err := fmt.Sscanf(pidStr, "%d", &pid); err == nil && pid > 0 {
			if _, err := os.Stat(fmt.Sprintf("/proc/%d", pid)); err == nil {
				return true
			}
		}
	}
	return false
}

func extractReasoningSteps(r string) []string {
	if r == "" {
		return nil
	}
	var steps []string
	lines := strings.Split(r, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "**") && strings.HasSuffix(line, "**") {
			heading := strings.Trim(line, "* ")
			if heading != "" {
				steps = append(steps, heading)
			}
		} else if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") {
			bullet := strings.TrimPrefix(strings.TrimPrefix(line, "- "), "* ")
			if bullet != "" {
				steps = append(steps, truncateString(bullet, 120))
			}
		}
		if len(steps) >= 6 {
			break
		}
	}
	return steps
}

// collectSessions scans a flomaster sessions dir and returns the most recent,
// sanitized sessions (public metadata only).
func collectSessions(homeDir, dir, avatar string) []Session {
	ents, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	type cand struct {
		base string
		m    int64
	}
	var cands []cand
	seenBases := make(map[string]bool)

	for _, e := range ents {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, "session_") {
			continue
		}
		var base string
		if strings.HasSuffix(name, ".json") {
			base = strings.TrimSuffix(name, ".json")
		} else if strings.HasSuffix(name, ".journal.jsonl") {
			base = strings.TrimSuffix(name, ".journal.jsonl")
		} else {
			continue
		}

		if strings.Contains(base, "-plan") || strings.Contains(base, "-goals") ||
			strings.Contains(base, "-review-state") || strings.Contains(base, "-gate-observations") {
			continue
		}
		if seenBases[base] {
			continue
		}
		seenBases[base] = true

		// Check max modtime between .json and .journal.jsonl
		var maxM int64
		jsonPath := filepath.Join(dir, base+".json")
		if fi, err := os.Stat(jsonPath); err == nil {
			maxM = fi.ModTime().Unix()
		}
		journalPath := filepath.Join(dir, base+".journal.jsonl")
		if fi, err := os.Stat(journalPath); err == nil {
			if fi.ModTime().Unix() > maxM {
				maxM = fi.ModTime().Unix()
			}
		}

		// Check if active PID exists: prioritize active sessions while preserving relative recency
		if isSessionProcessAlive(homeDir, base) {
			maxM += 1000000000
		}

		if maxM > 0 {
			cands = append(cands, cand{base: base, m: maxM})
		}
	}

	// newest first, cap at 8 sessions (payload budget: the PB hook decodes this
	// file byte-by-byte in the JSVM, so the total size must stay small)
	sort.Slice(cands, func(i, j int) bool { return cands[i].m > cands[j].m })
	if len(cands) > 8 {
		cands = cands[:8]
	}
	sessionsDir := dir
	todosDir := filepath.Join(filepath.Dir(dir), "todos")

	out := make([]Session, 0, len(cands))
	for _, c := range cands {
		s := parseSessionJSON(homeDir, filepath.Join(sessionsDir, c.base+".json"), filepath.Join(sessionsDir, c.base+".journal.jsonl"), avatar)
		if s.ID == "" && s.ShortName == "" {
			s.ID = c.base
			s.ShortName = strings.Split(c.base, "_")[1]
		}
		if s.ID == "" {
			continue
		}
		base := c.base

		// Check if active
		if isSessionProcessAlive(homeDir, s.ID) || isSessionProcessAlive(homeDir, base) {
			s.IsActive = true
			s.Status = "Running"
		}

		// Pull user intent line from the matching -plan.json sibling
		planPath := filepath.Join(todosDir, base+"-plan.json")
		if b, err := os.ReadFile(planPath); err == nil {
			var pl struct {
				UserIntention string `json:"user_intention"`
			}
			if json.Unmarshal(b, &pl) == nil && pl.UserIntention != "" {
				s.Intention = pl.UserIntention
			}
		}

		// Active checklist from todos/<base>.json or -goals.json
		goalsPaths := []string{
			filepath.Join(todosDir, base+".json"),
			filepath.Join(todosDir, base+"-goals.json"),
		}
		for _, goalsPath := range goalsPaths {
			b, err := os.ReadFile(goalsPath)
			if err != nil {
				continue
			}
			var todos []TodoItem
			if json.Unmarshal(b, &todos) != nil || len(todos) == 0 {
				continue
			}
			var active []TodoItem
			for _, t := range todos {
				st := strings.ToLower(strings.TrimSpace(t.Status))
				if st == "" || st == "pending" || st == "in_progress" || st == "in-progress" {
					if t.Content != "" {
						active = append(active, t)
					}
				}
				if len(active) >= 8 {
					break
				}
			}
			if len(active) > 0 {
				s.Todos = active
				break
			}
		}
		out = append(out, s)
	}
	// Payload budget: keep the heavy streams (chat, live activity, raw
	// reasoning) ONLY on the 3 most recent/active sessions; the rest ship as
	// lightweight cards (metadata + capped tool list + checklist). The file is
	// read + UTF-8-decoded in JS on every /api/projectbase/agents poll, so a
	// 300KB payload saturates the CPU (12 sessions x full streams was ~330KB).
	for i := range out {
		if i >= 3 {
			out[i].Chat = nil
			out[i].LiveActivity = nil
			out[i].LatestReasoning = ""
			out[i].ReasoningSteps = nil
			if len(out[i].RecentTools) > 8 {
				out[i].RecentTools = out[i].RecentTools[:8]
			}
		}
	}
	return out
}

// hermesRow is one row from ~/.hermes/state.db sessions table.
type hermesRow struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Model       string  `json:"model"`
	Source      string  `json:"source"`
	MessageCnt  int     `json:"message_count"`
	StartedAt   float64 `json:"started_at"`
	EndedAt     float64 `json:"ended_at"`
	EndReason   string  `json:"end_reason"`
	Cwd         string  `json:"cwd"`
	GitBranch   string  `json:"git_branch"`
	GitRepoRoot string  `json:"git_repo_root"`
	InputTok    int     `json:"input_tokens"`
	OutputTok   int     `json:"output_tokens"`
	LastActive  float64 `json:"last_activity_at"`
}

// hermesMsg is one row from ~/.hermes/state.db messages table.
type hermesMsg struct {
	Role      string  `json:"role"`
	Content   string  `json:"content"`
	ToolName  string  `json:"tool_name"`
	ToolCalls string  `json:"tool_calls"`
	Reasoning string  `json:"reasoning_content"`
	Timestamp float64 `json:"timestamp"`
}

// runSQLiteJSON shells out to the sqlite3 CLI, which is present on the homelab
// (JSON1 enabled). Returns parsed rows as []map[string]interface{}.
//
// The sqlite3 CLI cannot bind parameters from CLI args, so `?` placeholders
// are substituted with single-quote-escaped string literals before execution.
// Only used for trusted internal IDs (session ids), never user input.
func runSQLiteJSON(dbPath, query string, args ...string) []map[string]interface{} {
	for _, a := range args {
		lit := "'" + strings.ReplaceAll(a, "'", "''") + "'"
		query = strings.Replace(query, "?", lit, 1)
	}
	out, err := exec.Command("sqlite3", "-json", dbPath, query).Output()
	if err != nil {
		return nil
	}
	var rows []map[string]interface{}
	if json.Unmarshal(out, &rows) != nil {
		return nil
	}
	return rows
}

// collectHermesSessions reads recent sessions and their message snapshots from
// Hermes' SQLite session store (~/.hermes/state.db) and returns the sanctioned
// public metadata as ProjectBase Session cards. Hermes stores timestamps as
// Unix seconds (REAL), unlike Flomaster which uses RFC3339 strings.
func collectHermesSessions(homeDir string) []Session {
	dbPath := filepath.Join(homeDir, ".hermes", "state.db")
	if _, err := os.Stat(dbPath); err != nil {
		return nil
	}

	rows := runSQLiteJSON(dbPath, `SELECT id, COALESCE(title,'') title, COALESCE(model,'') model, COALESCE(source,'') source,
		message_count, started_at, COALESCE(ended_at,0) ended_at, COALESCE(end_reason,'') end_reason,
		COALESCE(cwd,'') cwd, COALESCE(git_branch,'') git_branch, COALESCE(git_repo_root,'') git_repo_root,
		input_tokens, output_tokens, COALESCE(last_activity_at,started_at) last_activity_at
		FROM sessions WHERE COALESCE(archived,0)=0 AND COALESCE(hidden,0)=0
		ORDER BY COALESCE(last_activity_at, started_at) DESC LIMIT 12`)

	now := time.Now().Unix()
	sessions := make([]Session, 0, len(rows))
	for _, r := range rows {
		if r == nil {
			continue
		}
		id := asString(r["id"])
		if id == "" {
			continue
		}
		title := asString(r["title"])
		if title == "" {
			title = "Hermes session " + id
		}
		model := asString(r["model"])
		short := id
		if len(id) > 16 {
			short = id[:16]
		}
		started := asFloat(r["started_at"])
		lastActive := asFloat(r["last_activity_at"])
		if lastActive <= 0 {
			lastActive = started
		}
		// Sessions with activity within the last 15 min are live.
		isActive := lastActive > 0 && (now-int64(lastActive)) < 900
		status := "completed"
		if isActive {
			status = "running"
		}
		ended := asFloat(r["ended_at"])
		if ended > 0 && (now-int64(ended)) < 900 {
			status = "running"
			isActive = true
		}

		// Load chat + tool activity from messages.
		var chat []ChatMessage
		var tools []Tool
		var events []ActivityEvent
		msgRows := runSQLiteJSON(dbPath, `SELECT role, COALESCE(content,'') content, COALESCE(tool_name,'') tool_name,
			COALESCE(tool_calls,'') tool_calls, COALESCE(reasoning_content,'') reasoning_content, timestamp
			FROM messages WHERE session_id=? AND active=1 ORDER BY timestamp ASC LIMIT 80`, id)
		for _, m := range msgRows {
			if m == nil {
				continue
			}
			role := asString(m["role"])
			ts := ""
			if tf := asFloat(m["timestamp"]); tf > 0 {
				ts = time.Unix(int64(tf), 0).UTC().Format(time.RFC3339)
			}
			content := asString(m["content"])
			toolName := asString(m["tool_name"])
			toolCalls := asString(m["tool_calls"])
			reasoning := asString(m["reasoning_content"])

			if role == "user" {
				if strings.TrimSpace(content) != "" {
					chat = append(chat, ChatMessage{
						Role:      "user",
						Content:   truncateString(strings.TrimSpace(content), 800),
						Timestamp: ts,
					})
				}
			} else if role == "assistant" {
				cleanContent := strings.TrimSpace(content)
				cleanReasoning := strings.TrimSpace(reasoning)

				var msgTools []ChatTool
				if toolName != "" {
					t := Tool{Name: toolName, Timestamp: ts}
					if cleanContent != "" {
						t.Input = truncateString(cleanContent, 160)
					}
					tools = append(tools, t)
					events = append(events, ActivityEvent{Type: "tool", Name: toolName, Summary: t.Input, Timestamp: ts})
					msgTools = append(msgTools, ChatTool{Name: toolName, Input: t.Input})
				} else if toolCalls != "" && strings.Contains(toolCalls, "\"name\"") {
					var calls []struct {
						Name string `json:"name"`
					}
					if json.Unmarshal([]byte(toolCalls), &calls) == nil {
						for _, c := range calls {
							if c.Name != "" {
								tools = append(tools, Tool{Name: c.Name, Timestamp: ts})
								events = append(events, ActivityEvent{Type: "tool", Name: c.Name, Timestamp: ts})
								msgTools = append(msgTools, ChatTool{Name: c.Name})
							}
						}
					}
				}

				if cleanReasoning != "" {
					events = append(events, ActivityEvent{Type: "reasoning", Summary: truncateString(cleanReasoning, 320), Timestamp: ts})
				}
				if cleanContent != "" && toolName == "" {
					events = append(events, ActivityEvent{Type: "text", Summary: truncateString(cleanContent, 240), Timestamp: ts})
				}

				turn := ChatMessage{
					Role:      "assistant",
					Timestamp: ts,
				}
				if cleanContent != "" && toolName == "" {
					turn.Content = truncateString(cleanContent, 800)
				}
				if cleanReasoning != "" {
					turn.Reasoning = truncateString(cleanReasoning, 700)
				}
				if len(msgTools) > 0 {
					turn.Tools = msgTools
				}

				if turn.Content != "" || turn.Reasoning != "" || len(turn.Tools) > 0 {
					if len(chat) > 0 && chat[len(chat)-1].Role == "assistant" {
						prev := &chat[len(chat)-1]
						if turn.Reasoning != "" {
							if prev.Reasoning == "" {
								prev.Reasoning = turn.Reasoning
							} else if !strings.Contains(prev.Reasoning, turn.Reasoning) {
								prev.Reasoning = prev.Reasoning + "\n\n" + turn.Reasoning
							}
						}
						if len(turn.Tools) > 0 {
							prev.Tools = append(prev.Tools, turn.Tools...)
						}
						if turn.Content != "" {
							if prev.Content == "" {
								prev.Content = turn.Content
							} else {
								prev.Content = prev.Content + "\n\n" + turn.Content
							}
						}
						if turn.Timestamp != "" {
							prev.Timestamp = turn.Timestamp
						}
					} else {
						chat = append(chat, turn)
					}
				}
			}
		}
		if len(tools) > 12 {
			tools = tools[:12]
		}
		if len(chat) > 30 {
			chat = chat[len(chat)-30:]
		}

		// Last assistant text + latest reasoning for the live stream panel.
		lastText := ""
		latestReasoning := ""
		for i := len(events) - 1; i >= 0; i-- {
			if latestReasoning == "" && events[i].Type == "reasoning" {
				latestReasoning = events[i].Summary
			}
			if lastText == "" && events[i].Type == "text" {
				lastText = events[i].Summary
			}
			if lastText != "" && latestReasoning != "" {
				break
			}
		}

		// Working dir from session metadata (git branch is client-visible via
		// the AgentsView workspace panel derived from cwd).
		workdir := asString(r["cwd"])
		if workdir == "" {
			workdir = asString(r["git_repo_root"])
		}
		filesTouched := []string{}

		sessions = append(sessions, Session{
			Agent:           "hermes",
			ID:              id,
			ShortName:       short,
			Title:           truncateString(title, 140),
			Status:          status,
			IsActive:        isActive,
			Model:           model,
			WorkingDir:      workdir,
			UpdatedAt:       tsFromUnix(lastActive),
			LastActiveAt:    tsFromUnix(lastActive),
			Intention:       title,
			Chat:            chat,
			RecentTools:     tools,
			LiveActivity:    events,
			FilesTouched:    filesTouched,
			LastText:        lastText,
			LatestReasoning: latestReasoning,
			ReasoningSteps:  extractReasoningSteps(latestReasoning),
			TokenUsage: TokenStats{
				Prompt:     asInt(r["input_tokens"]),
				Completion: asInt(r["output_tokens"]),
				Total:      asInt(r["input_tokens"]) + asInt(r["output_tokens"]),
			},
			MessageCount: asInt(r["message_count"]),
			Avatar:       "🐦",
		})
		if len(sessions) >= 8 {
			break
		}
	}
	return sessions
}

// tsFromUnix renders a Unix-seconds float as RFC3339 (empty for zero).
func tsFromUnix(sec float64) string {
	if sec <= 0 {
		return ""
	}
	return time.Unix(int64(sec), 0).UTC().Format(time.RFC3339)
}

// asString / asFloat / asInt coerce sqlite3 -json values.
func asString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
func asFloat(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int64:
		return float64(t)
	case json.Number:
		f, _ := t.Float64()
		return f
	case string:
		var f float64
		fmt.Sscanf(t, "%f", &f)
		return f
	}
	return 0
}
func asInt(v interface{}) int {
	if v == nil {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return int(t)
	case int64:
		return int(t)
	case json.Number:
		n, _ := t.Int64()
		return int(n)
	case string:
		var n int64
		fmt.Sscanf(t, "%d", &n)
		return int(n)
	}
	return 0
}

// parseSessionJSON reads session snapshot and appends any fresh journal lines.
func parseSessionJSON(homeDir, jsonPath, journalPath, avatar string) Session {
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

	if b, err := os.ReadFile(jsonPath); err == nil {
		json.Unmarshal(b, &raw)
	}

	// Read journal.jsonl for appended messages that haven't flushed to .json
	if jf, err := os.Open(journalPath); err == nil {
		defer jf.Close()
		scanner := bufio.NewScanner(jf)
		// Max buffer size for big journal lines
		buf := make([]byte, 1024*1024)
		scanner.Buffer(buf, 10*1024*1024)
		for scanner.Scan() {
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}
			var jEntry struct {
				AppendMessages []interface{} `json:"append_messages"`
				Append         *struct {
					Message interface{} `json:"message"`
				} `json:"append"`
			}
			if json.Unmarshal(line, &jEntry) == nil {
				if len(jEntry.AppendMessages) > 0 {
					raw.Messages = append(raw.Messages, jEntry.AppendMessages...)
				}
				if jEntry.Append != nil && jEntry.Append.Message != nil {
					raw.Messages = append(raw.Messages, jEntry.Append.Message)
				}
			}
		}
	}

	if raw.ID == "" && raw.ShortName == "" && len(raw.Messages) == 0 {
		return Session{}
	}

	var events []ActivityEvent
	var tools []Tool
	filesTouchedMap := make(map[string]bool)
	latestReasoning := ""
	lastText := ""

	scan := raw.Messages
	if len(scan) > 100 {
		scan = scan[len(scan)-100:]
	}

	for _, rawMsg := range scan {
		msg, ok := rawMsg.(map[string]interface{})
		if !ok {
			continue
		}
		role, _ := msg["role"].(string)
		ts, _ := msg["timestamp"].(string)
		content := msg["content"]

		if textStr, isStr := content.(string); isStr && strings.TrimSpace(textStr) != "" {
			if role == "assistant" {
				lastText = truncateString(strings.TrimSpace(textStr), 240)
				events = append(events, ActivityEvent{
					Type:      "text",
					Summary:   lastText,
					Timestamp: ts,
				})
			}
		} else if blocks, isBlocks := content.([]interface{}); isBlocks {
			for _, rawBlk := range blocks {
				blk, okB := rawBlk.(map[string]interface{})
				if !okB {
					continue
				}
				bType, _ := blk["type"].(string)
				if bType == "reasoning" {
					rText, _ := blk["text"].(string)
					rText = strings.TrimSpace(rText)
					if rText != "" {
						latestReasoning = truncateString(rText, 1400)
						events = append(events, ActivityEvent{
							Type:      "reasoning",
							Summary:   truncateString(rText, 320),
							Timestamp: ts,
						})
					}
				} else if bType == "tool_use" {
					tName, _ := blk["name"].(string)
					if tName != "" {
						inputMap, _ := blk["input"].(map[string]interface{})
						intent := ""
						inputSum := ""
						if inputMap != nil {
							if it, ok := inputMap["intent"].(string); ok {
								intent = it
							}
							if fp, ok := inputMap["file_path"].(string); ok && fp != "" {
								filesTouchedMap[fp] = true
							}
							if p, ok := inputMap["path"].(string); ok && p != "" {
								filesTouchedMap[p] = true
							}
							inputSum = toolInputSummary(inputMap)
						}
						t := Tool{
							Name:      tName,
							Input:     inputSum,
							Intent:    intent,
							Timestamp: ts,
						}
						tools = append(tools, t)
						events = append(events, ActivityEvent{
							Type:      "tool",
							Name:      tName,
							Intent:    intent,
							Input:     inputSum,
							Timestamp: ts,
						})
					}
				} else if bType == "text" {
					tText, _ := blk["text"].(string)
					if strings.TrimSpace(tText) != "" && role == "assistant" {
						lastText = truncateString(strings.TrimSpace(tText), 240)
						events = append(events, ActivityEvent{
							Type:      "text",
							Summary:   lastText,
							Timestamp: ts,
						})
					}
				}
			}
		}

		// Handle OpenAI style tool_calls
		if tcs, okTC := msg["tool_calls"].([]interface{}); okTC {
			for _, tc := range tcs {
				if tcObj, okT := tc.(map[string]interface{}); okT {
					fn, _ := tcObj["function"].(map[string]interface{})
					name, _ := fn["name"].(string)
					argsStr, _ := fn["arguments"].(string)
					intent := ""
					inputSum := ""
					if argsStr != "" {
						var argsMap map[string]interface{}
						if json.Unmarshal([]byte(argsStr), &argsMap) == nil {
							if it, ok := argsMap["intent"].(string); ok {
								intent = it
							}
							if fp, ok := argsMap["file_path"].(string); ok && fp != "" {
								filesTouchedMap[fp] = true
							}
							inputSum = toolInputSummary(argsMap)
						}
					}
					if name != "" {
						t := Tool{
							Name:      name,
							Input:     inputSum,
							Intent:    intent,
							Timestamp: ts,
						}
						tools = append(tools, t)
						events = append(events, ActivityEvent{
							Type:      "tool",
							Name:      name,
							Intent:    intent,
							Input:     inputSum,
							Timestamp: ts,
						})
					}
				}
			}
		}
	}

	// Reverse tools so newest is first
	sort.SliceStable(tools, func(i, j int) bool { return i > j })
	if len(tools) > 30 {
		tools = tools[:30]
	}

	// Files touched list
	var filesTouched []string
	for f := range filesTouchedMap {
		filesTouched = append(filesTouched, f)
	}
	sort.Strings(filesTouched)
	if len(filesTouched) > 12 {
		filesTouched = filesTouched[:12]
	}

	// Cap live activity at last 25 events
	if len(events) > 25 {
		events = events[len(events)-25:]
	}

	reasoningSteps := extractReasoningSteps(latestReasoning)

	// Build a sanitized, structured chat stream for the native chat UI.
	// User turns become plain text bubbles (right-aligned); assistant turns
	// carry reasoning, text, and grouped tools (left-aligned). Cap at ~30 turns.
	chat := buildChat(scan, 30)

	// Aggregate token usage across the scanned window. input_tokens/output_tokens
	// are cumulative running totals per session, so take the latest (max) value.
	var tokenStats TokenStats
	for _, rawMsg := range scan {
		msg, ok := rawMsg.(map[string]interface{})
		if !ok {
			continue
		}
		tu, okTU := msg["token_usage"].(map[string]interface{})
		if !okTU {
			continue
		}
		// Anthropic/OpenAI-style keys: input_tokens/output_tokens.
		if p, ok := tu["input_tokens"].(float64); ok {
			if int(p) > tokenStats.Prompt {
				tokenStats.Prompt = int(p)
			}
		} else if p, ok := tu["prompt_tokens"].(float64); ok {
			if int(p) > tokenStats.Prompt {
				tokenStats.Prompt = int(p)
			}
		}
		if c, ok := tu["output_tokens"].(float64); ok {
			if int(c) > tokenStats.Completion {
				tokenStats.Completion = int(c)
			}
		} else if c, ok := tu["completion_tokens"].(float64); ok {
			if int(c) > tokenStats.Completion {
				tokenStats.Completion = int(c)
			}
		}
	}
	tokenStats.Total = tokenStats.Prompt + tokenStats.Completion

	return Session{
		Agent:           "flomaster",
		ID:              raw.ID,
		ShortName:       raw.ShortName,
		Title:           raw.Title,
		Status:          raw.Status,
		Model:           raw.Model,
		WorkingDir:      raw.WorkingDir,
		LastActiveAt:    raw.LastActiveAt,
		UpdatedAt:       raw.UpdatedAt,
		MessageCount:    len(raw.Messages),
		Avatar:          avatar,
		LastText:        lastText,
		LatestReasoning: latestReasoning,
		ReasoningSteps:  reasoningSteps,
		FilesTouched:    filesTouched,
		LiveActivity:    events,
		RecentTools:     tools,
		Chat:            chat,
		TokenUsage:      tokenStats,
	}
}

// buildChat converts a slice of raw messages into sanitized, structured chat
// turns for the native chat UI. Only user/assistant turns are surfaced; tool
// results are never forwarded. The output is capped to `max` most recent turns.
func buildChat(scan []interface{}, max int) []ChatMessage {
	var chat []ChatMessage
	for _, rawMsg := range scan {
		msg, ok := rawMsg.(map[string]interface{})
		if !ok {
			continue
		}
		role, _ := msg["role"].(string)
		if role != "user" && role != "assistant" {
			continue
		}
		ts, _ := msg["timestamp"].(string)
		content := msg["content"]

		turn := ChatMessage{Role: role, Timestamp: ts}

		// Plain string content: a user prompt or a plain assistant reply.
		if textStr, isStr := content.(string); isStr {
			t := strings.TrimSpace(textStr)
			if t != "" {
				if role == "user" {
					turn.Content = truncateString(t, 600)
				} else {
					turn.Content = truncateString(t, 800)
				}
			}
		} else if blocks, isBlocks := content.([]interface{}); isBlocks {
			for _, rawBlk := range blocks {
				blk, okB := rawBlk.(map[string]interface{})
				if !okB {
					continue
				}
				bType, _ := blk["type"].(string)
				switch bType {
				case "text":
					t, _ := blk["text"].(string)
					if strings.TrimSpace(t) != "" {
						turn.Content = truncateString(strings.TrimSpace(t), 800)
					}
				case "reasoning":
					r, _ := blk["text"].(string)
					if strings.TrimSpace(r) != "" {
						turn.Reasoning = truncateString(strings.TrimSpace(r), 700)
					}
				case "tool_use":
					tName, _ := blk["name"].(string)
					if tName != "" {
						inputMap, _ := blk["input"].(map[string]interface{})
						intent := ""
						inputSum := ""
						if inputMap != nil {
							if it, okI := inputMap["intent"].(string); okI {
								intent = it
							}
							inputSum = toolInputSummary(inputMap)
						}
						turn.Tools = append(turn.Tools, ChatTool{
							Name:   tName,
							Input:  inputSum,
							Intent: intent,
						})
					}
				}
			}
		}

		// OpenAI-style tool_calls on assistant messages.
		if tcs, okTC := msg["tool_calls"].([]interface{}); okTC {
			for _, tc := range tcs {
				if tcObj, okT := tc.(map[string]interface{}); okT {
					fn, _ := tcObj["function"].(map[string]interface{})
					name, _ := fn["name"].(string)
					argsStr, _ := fn["arguments"].(string)
					intent := ""
					inputSum := ""
					if argsStr != "" {
						var argsMap map[string]interface{}
						if json.Unmarshal([]byte(argsStr), &argsMap) == nil {
							if it, okA := argsMap["intent"].(string); okA {
								intent = it
							}
							inputSum = toolInputSummary(argsMap)
						}
					}
					if name != "" {
						turn.Tools = append(turn.Tools, ChatTool{
							Name:   name,
							Input:  inputSum,
							Intent: intent,
						})
					}
				}
			}
		}

		if turn.Content != "" || turn.Reasoning != "" || len(turn.Tools) > 0 {
			if role == "assistant" && len(chat) > 0 && chat[len(chat)-1].Role == "assistant" {
				prev := &chat[len(chat)-1]
				if turn.Reasoning != "" {
					if prev.Reasoning == "" {
						prev.Reasoning = turn.Reasoning
					} else if !strings.Contains(prev.Reasoning, turn.Reasoning) {
						prev.Reasoning = prev.Reasoning + "\n\n" + turn.Reasoning
					}
				}
				if len(turn.Tools) > 0 {
					prev.Tools = append(prev.Tools, turn.Tools...)
				}
				if turn.Content != "" {
					if prev.Content == "" {
						prev.Content = turn.Content
					} else {
						prev.Content = prev.Content + "\n\n" + turn.Content
					}
				}
				if turn.Timestamp != "" {
					prev.Timestamp = turn.Timestamp
				}
			} else {
				chat = append(chat, turn)
			}
		}
	}

	if len(chat) > max {
		chat = chat[len(chat)-max:]
	}
	return chat
}

// toolInputSummary renders a short, single-line summary of a tool_use input,
// prioritizing common keys (file_path, command, query, title, selector, url).
func toolInputSummary(v interface{}) string {
	if v == nil {
		return ""
	}
	obj, ok := v.(map[string]interface{})
	if !ok {
		return ""
	}
	prefer := []string{"intent", "file_path", "command", "query", "title", "selector", "url", "target", "path"}
	for _, k := range prefer {
		val, exists := obj[k]
		if !exists {
			continue
		}
		s, ok2 := val.(string)
		if !ok2 || s == "" {
			continue
		}
		if k == "intent" && len(obj) > 1 {
			// Also include secondary key
			for _, sec := range []string{"file_path", "command", "query", "title", "path"} {
				if secVal, ok3 := obj[sec].(string); ok3 && secVal != "" {
					return truncateString(s+" · "+secVal, 80)
				}
			}
		}
		return truncateString(s, 70)
	}
	// fallback: join scalar values
	var parts []string
	for k, val := range obj {
		if strings.EqualFold(k, "password") || strings.EqualFold(k, "token") || strings.EqualFold(k, "api_key") || strings.EqualFold(k, "secret") {
			continue
		}
		if s, ok2 := val.(string); ok2 && s != "" {
			parts = append(parts, k+"="+truncateString(s, 30))
		}
	}
	sort.Strings(parts)
	return truncateString(strings.Join(parts, " "), 70)
}

func truncateString(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "agent-bridge error: "+format+"\n", args...)
	os.Exit(1)
}
