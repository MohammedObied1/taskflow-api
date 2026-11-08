import { describe, expect, it } from "vitest";
import {
  byUrgency,
  dayKey,
  displayName,
  dueDay,
  isOverdue,
  projectPeople,
  projectRole,
} from "./format.js";

describe("displayName", () => {
  it("prefers full_name over username", () => {
    expect(displayName({ full_name: "Alice A.", username: "alice" })).toBe("Alice A.");
  });

  it("falls back to username when full_name is empty", () => {
    expect(displayName({ full_name: "", username: "alice" })).toBe("alice");
  });

  it("returns an empty string for no user", () => {
    expect(displayName(null)).toBe("");
  });
});

describe("dueDay", () => {
  it("extracts the calendar day from an ISO timestamp", () => {
    expect(dueDay({ due_date: "2026-03-05T23:59:59Z" })).toBe("2026-03-05");
  });

  it("returns null when there is no due date", () => {
    expect(dueDay({ due_date: null })).toBeNull();
  });
});

describe("isOverdue", () => {
  it("is false for done tasks even with a past due date", () => {
    expect(isOverdue({ status: "done", due_date: "2000-01-01T23:59:59Z" })).toBe(false);
  });

  it("is true for a non-done task whose due day has passed", () => {
    expect(isOverdue({ status: "todo", due_date: "2000-01-01T23:59:59Z" })).toBe(true);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue({ status: "todo", due_date: null })).toBe(false);
  });

  it("is false for a task due today", () => {
    expect(isOverdue({ status: "todo", due_date: `${dayKey()}T23:59:59Z` })).toBe(false);
  });
});

describe("byUrgency", () => {
  it("sorts undated tasks after dated ones", () => {
    const dated = { due_date: "2026-01-01T23:59:59Z", priority: "low" };
    const undated = { due_date: null, priority: "critical" };
    expect(byUrgency(dated, undated)).toBeLessThan(0);
  });

  it("breaks ties on the same due day by priority rank", () => {
    const critical = { due_date: "2026-01-01T23:59:59Z", priority: "critical" };
    const low = { due_date: "2026-01-01T23:59:59Z", priority: "low" };
    expect(byUrgency(critical, low)).toBeLessThan(0);
  });
});

describe("projectRole", () => {
  const owner = { id: 1, role: "user" };
  const editor = { id: 2, role: "user" };
  const stranger = { id: 3, role: "user" };
  const admin = { id: 4, role: "admin" };
  const project = {
    owner: { id: 1 },
    members: [{ user: { id: 2 }, role: "editor" }],
  };

  it("treats the project owner as owner", () => {
    expect(projectRole(project, owner)).toBe("owner");
  });

  it("looks up a member's role", () => {
    expect(projectRole(project, editor)).toBe("editor");
  });

  it("returns null for someone with no relationship to the project", () => {
    expect(projectRole(project, stranger)).toBeNull();
  });

  it("treats a global admin as owner regardless of membership", () => {
    expect(projectRole(project, admin)).toBe("owner");
  });

  it("returns null when project or user is missing", () => {
    expect(projectRole(null, owner)).toBeNull();
    expect(projectRole(project, null)).toBeNull();
  });
});

describe("projectPeople", () => {
  it("prepends the owner when the seed didn't add them as a member", () => {
    const project = { owner: { id: 1 }, members: [{ user: { id: 2 }, role: "editor" }] };
    const people = projectPeople(project);
    expect(people[0]).toEqual({ user: { id: 1 }, role: "owner" });
    expect(people).toHaveLength(2);
  });

  it("doesn't duplicate the owner when already a member", () => {
    const project = { owner: { id: 1 }, members: [{ user: { id: 1 }, role: "owner" }] };
    expect(projectPeople(project)).toHaveLength(1);
  });
});
