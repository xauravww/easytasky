import { chatWithTools } from "./aiClient";
import { describeProposal, proposalsFromToolCalls } from "./agents";
import type { BlockProposal } from "./agents";
import { useStore } from "../store/useStore";
import { dayKey } from "../utils/time";

export type AgentMessage = { role: "user" | "assistant"; content: string };

export const buildContext = (): string => {
  const state = useStore.getState();
  const today = dayKey();
  const fmt24 = (min: number) => `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;
  const openTasks = state.tasks.filter((t) => t.status !== "done" && t.status !== "habit");
  const todayBlocks = state.blocks.filter((b) => b.day === today).sort((a, b) => a.start_min - b.start_min);
  const habits = state.tasks.filter((t) => t.is_habit === 1);
  const sections = state.sections;

  const parts: string[] = [];
  parts.push("This is the user's CURRENT ACTUAL data in EasyTasky. You have full access and direct control over all of it.");
  if (state.profile.trim()) {
    parts.push(`About the user (their own words):\n${state.profile.trim()}`);
  }
  if (sections.length) {
    parts.push(`Categories / Sections:\n${sections.map((s) => `- ${s.name}`).join("\n")}`);
  }
  if (openTasks.length) {
    const shown = openTasks.slice(0, 20).map((t) => `- [${t.status}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}${t.quadrant ? ` (${t.quadrant})` : ""}`);
    parts.push(`Open tasks:\n${shown.join("\n")}`);
  }
  if (habits.length) {
    const shownHabits = habits.map((h) => {
      const check = state.habitChecks.find((c) => c.habit_id === h.id && c.day === today);
      const val = check?.value ?? (check ? 1 : 0);
      return `- ${h.title} (type: ${h.habit_type || "boolean"}, today: ${val}/${h.habit_target_value || 1} ${h.habit_unit || "times"})`;
    });
    parts.push(`Habits:\n${shownHabits.join("\n")}`);
  }
  if (todayBlocks.length) {
    const shown = todayBlocks.map((b) => `- ${fmt24(b.start_min)}-${fmt24(b.end_min)} ${b.label} (${b.type})`);
    parts.push(`Today's time blocks:\n${shown.join("\n")}`);
  } else {
    parts.push("Today's time blocks: (none)");
  }
  const note = state.getDailyNote(today);
  if (note.trim()) {
    parts.push(`Today's note/journal:\n${note.trim()}`);
  }
  if (state.shutdownRituals.length) {
    const shownRituals = state.shutdownRituals.map((r) => {
      const checked = state.shutdownChecks.some((c) => c.ritual_id === r.id && c.day === today);
      return `- [${checked ? "x" : " "}] ${r.title}`;
    });
    parts.push(`Shutdown rituals (today):\n${shownRituals.join("\n")}`);
  }
  const pomo = state.pomo;
  const taskRunning = pomo.taskId ? state.tasks.find((t) => t.id === pomo.taskId)?.title : undefined;
  parts.push(`Focus Timer / Pomodoro: ${pomo.running ? `RUNNING (${pomo.mode}, ${Math.ceil(pomo.left / 60)} min left)` : "IDLE"}${taskRunning ? ` for task: "${taskRunning}"` : ""}`);
  return parts.join("\n\n");
};

type NamedResolution<T> = { value?: T; error?: string };

export type ActionExecutionResult = {
  applied: string[];
  failed: { proposal: BlockProposal; reason: string }[];
};

const MAX_ACTION_ATTEMPTS = 3;

const normalize = (value: string) => value.trim().toLowerCase();

const resolveNamed = <T>(
  items: T[],
  query: string,
  getName: (item: T) => string,
  label: string
): NamedResolution<T> => {
  const q = normalize(query);
  const exact = items.filter((item) => normalize(getName(item)) === q);
  if (exact.length === 1) return { value: exact[0] };
  if (exact.length > 1) return { error: `Multiple ${label}s are named "${query}".` };

  const partial = items.filter((item) => normalize(getName(item)).includes(q));
  if (partial.length === 1) return { value: partial[0] };
  if (!partial.length) return { error: `No ${label} matched "${query}".` };
  return {
    error: `"${query}" matched multiple ${label}s: ${partial
      .slice(0, 5)
      .map(getName)
      .join(", ")}. Use an exact name.`,
  };
};

const matchesPatch = (value: object, patch: object): boolean =>
  Object.entries(patch).every(
    ([key, expected]) => (value as Record<string, unknown>)[key] === expected
  );

const formatExecutionResult = (result: ActionExecutionResult): string => {
  const successes = result.applied.length ? `Done: ${result.applied.join("; ")}.` : "";
  const failures = result.failed.length
    ? `Not changed: ${result.failed.map((f) => f.reason).join(" ")}`
    : "";
  return [successes, failures].filter(Boolean).join("\n\n");
};

const isDataActionRequest = (history: AgentMessage[]): boolean => {
  const text = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const action =
    /\b(add|create|delete|remove|update|change|edit|rename|complete|mark|move|schedule|reschedule|log|save|set|start|stop|pause|reset|put|check\s*off)\b|जोड़|बना|हटा|मिटा|बदल|पूरा|लॉग|सेव|शुरू|रोक|अपडेट|डिलीट/i;
  const domain =
    /\b(task|to-?do|habit|time\s*block|block|section|category|note|profile|timer|ritual|schedule|calendar|database|db)\b|टास्क|आदत|ब्लॉक|सेक्शन|कैटेगरी|नोट|प्रोफाइल|टाइमर|रिचुअल/i;
  return action.test(text) && domain.test(text);
};

export const executeProposals = async (
  proposals: BlockProposal[]
): Promise<ActionExecutionResult> => {
  const applied: string[] = [];
  const failed: ActionExecutionResult["failed"] = [];
  const fmt24 = (min: number) =>
    `${Math.floor(min / 60)}:${`${min % 60}`.padStart(2, "0")}`;
  const today = dayKey();
  const fail = (proposal: BlockProposal, reason: string) => failed.push({ proposal, reason });
  const refresh = () => useStore.getState().refreshAll();

  for (const p of proposals) {
    try {
      const state = useStore.getState();

      if (p.kind === "addBlock") {
        const before = new Set(state.blocks.map((b) => b.id));
        await state.addBlock(p.block);
        await refresh();
        const verified = useStore
          .getState()
          .blocks.some(
            (b) =>
              !before.has(b.id) &&
              b.day === p.block.day &&
              b.start_min === p.block.start_min &&
              b.end_min === p.block.end_min &&
              b.label === p.block.label &&
              b.type === p.block.type
          );
        if (verified) {
          applied.push(
            `added time block "${p.block.label}" ${fmt24(p.block.start_min)}-${fmt24(p.block.end_min)}`
          );
        } else {
          fail(p, `The time block "${p.block.label}" was not found in the database after saving.`);
        }
      } else if (p.kind === "updateBlock") {
        const block = state.blocks.find((b) => b.id === p.id);
        if (!block) {
          fail(p, `Time block #${p.id} no longer exists.`);
          continue;
        }
        await state.updateBlock(p.id, p.patch);
        await refresh();
        const updated = useStore.getState().blocks.find((b) => b.id === p.id);
        if (updated && matchesPatch(updated, p.patch)) {
          applied.push(`updated time block "${block.label}"`);
        } else {
          fail(p, `The database did not retain the requested changes to "${block.label}".`);
        }
      } else if (p.kind === "deleteBlock") {
        const block = state.blocks.find((b) => b.id === p.id);
        if (!block) {
          fail(p, `Time block #${p.id} no longer exists.`);
          continue;
        }
        await state.deleteBlock(p.id);
        await refresh();
        if (!useStore.getState().blocks.some((b) => b.id === p.id)) {
          applied.push(`removed time block "${block.label}"`);
        } else {
          fail(p, `The time block "${block.label}" still exists after deletion.`);
        }
      } else if (p.kind === "createSection") {
        const section = await state.addSection(p.name, p.color);
        await refresh();
        const verified = useStore.getState().sections.some((s) => s.id === section.id);
        if (verified) applied.push(`created category "${p.name}"`);
        else fail(p, `The category "${p.name}" was not found in the database after saving.`);
      } else if (p.kind === "deleteSection") {
        const resolved = resolveNamed(state.sections, p.name, (s) => s.name, "category");
        if (!resolved.value) {
          fail(p, resolved.error ?? `Category "${p.name}" was not found.`);
          continue;
        }
        await state.deleteSection(resolved.value.id);
        await refresh();
        if (!useStore.getState().sections.some((s) => s.id === resolved.value!.id)) {
          applied.push(`deleted category "${resolved.value.name}"`);
        } else {
          fail(p, `The category "${resolved.value.name}" still exists after deletion.`);
        }
      } else if (p.kind === "addTask") {
        let sectionId: string | undefined;
        if (p.task.section_name) {
          const section = resolveNamed(
            state.sections,
            p.task.section_name,
            (s) => s.name,
            "category"
          );
          if (!section.value) {
            fail(p, section.error ?? `Category "${p.task.section_name}" was not found.`);
            continue;
          }
          sectionId = section.value.id;
        }
        const before = new Set(state.tasks.map((t) => t.id));
        await state.addTask({
          title: p.task.title,
          context: p.task.context,
          energy: p.task.energy as any,
          quadrant: p.task.quadrant as any,
          due_date: p.task.due_date,
          estimated_min: p.task.estimated_min,
          note: p.task.note,
          section_id: sectionId,
        });
        await refresh();
        const created = useStore
          .getState()
          .tasks.find(
            (t) => !before.has(t.id) && t.title === p.task.title && t.section_id === (sectionId ?? null)
          );
        if (created) applied.push(`created task "${created.title}"`);
        else fail(p, `The task "${p.task.title}" was not found in the database after saving.`);
      } else if (p.kind === "updateTask") {
        if (!Object.keys(p.patch).length) {
          fail(p, `No fields were provided to update task "${p.find}".`);
          continue;
        }
        const resolved = resolveNamed(state.tasks, p.find, (t) => t.title, "task");
        if (!resolved.value) {
          fail(p, resolved.error ?? `Task "${p.find}" was not found.`);
          continue;
        }
        await state.updateTask(resolved.value.id, p.patch as any);
        await refresh();
        const updated = useStore.getState().tasks.find((t) => t.id === resolved.value!.id);
        if (updated && matchesPatch(updated, p.patch)) {
          applied.push(`updated task "${updated.title}"`);
        } else {
          fail(p, `The database did not retain the requested changes to "${resolved.value.title}".`);
        }
      } else if (p.kind === "deleteTask" || p.kind === "completeTask") {
        const resolved = resolveNamed(state.tasks, p.find, (t) => t.title, "task");
        if (!resolved.value) {
          fail(p, resolved.error ?? `Task "${p.find}" was not found.`);
          continue;
        }
        const task = resolved.value;
        if (p.kind === "deleteTask") await state.deleteTask(task.id);
        else await state.updateTask(task.id, { status: "done" });
        await refresh();
        const current = useStore.getState().tasks.find((t) => t.id === task.id);
        const verified = p.kind === "deleteTask" ? !current : current?.status === "done";
        if (verified) {
          applied.push(`${p.kind === "deleteTask" ? "deleted" : "completed"} task "${task.title}"`);
        } else {
          fail(
            p,
            `The task "${task.title}" was not ${p.kind === "deleteTask" ? "deleted" : "completed"}.`
          );
        }
      } else if (p.kind === "addSubtask") {
        const task = resolveNamed(state.tasks, p.taskFind, (t) => t.title, "task");
        if (!task.value) {
          fail(p, task.error ?? `Task "${p.taskFind}" was not found.`);
          continue;
        }
        const before = new Set(state.subtasks.map((s) => s.id));
        await state.addSubtask(task.value.id, p.title);
        await refresh();
        const created = useStore
          .getState()
          .subtasks.find(
            (s) => !before.has(s.id) && s.task_id === task.value!.id && s.title === p.title.trim()
          );
        if (created) applied.push(`added subtask "${created.title}" to "${task.value.title}"`);
        else fail(p, `The subtask "${p.title}" was not found in the database after saving.`);
      } else if (p.kind === "toggleSubtask") {
        const subtask = resolveNamed(
          state.subtasks,
          p.subtaskTitle,
          (s) => s.title,
          "subtask"
        );
        if (!subtask.value) {
          fail(p, subtask.error ?? `Subtask "${p.subtaskTitle}" was not found.`);
          continue;
        }
        const previous = subtask.value.done;
        await state.toggleSubtask(subtask.value.id);
        await refresh();
        const current = useStore.getState().subtasks.find((s) => s.id === subtask.value!.id);
        if (current && current.done !== previous) applied.push(`toggled subtask "${current.title}"`);
        else fail(p, `The subtask "${subtask.value.title}" did not change.`);
      } else if (p.kind === "addHabit") {
        const before = new Set(state.tasks.map((t) => t.id));
        const quantity = p.habit.habit_type === "quantity" || (p.habit.target_value ?? 1) > 1;
        await state.addTask({
          title: p.habit.title,
          status: "habit",
          is_habit: 1,
          habit_type: quantity ? "quantity" : "boolean",
          habit_target_value: p.habit.target_value ?? 1,
          habit_unit: p.habit.unit ?? (quantity ? "times" : undefined),
          habit_color: p.habit.color ?? "#FA6E1E",
          habit_freq: p.habit.freq ?? "daily",
        });
        await refresh();
        const created = useStore
          .getState()
          .tasks.find((t) => !before.has(t.id) && t.is_habit === 1 && t.title === p.habit.title);
        if (created) applied.push(`created habit "${created.title}"`);
        else fail(p, `The habit "${p.habit.title}" was not found in the database after saving.`);
      } else if (p.kind === "logHabit" || p.kind === "deleteHabit") {
        const habits = state.tasks.filter((t) => t.is_habit === 1);
        const resolved = resolveNamed(habits, p.find, (h) => h.title, "habit");
        if (!resolved.value) {
          fail(p, resolved.error ?? `Habit "${p.find}" was not found.`);
          continue;
        }
        const habit = resolved.value;
        if (p.kind === "deleteHabit") {
          await state.deleteTask(habit.id);
          await refresh();
          if (!useStore.getState().tasks.some((t) => t.id === habit.id)) {
            applied.push(`deleted habit "${habit.title}"`);
          } else {
            fail(p, `The habit "${habit.title}" still exists after deletion.`);
          }
        } else {
          await state.logHabitValue(habit.id, today, p.value);
          await refresh();
          const check = useStore
            .getState()
            .habitChecks.find((c) => c.habit_id === habit.id && c.day === today);
          const verified = p.value <= 0 ? !check : !!check && (check.value ?? 1) === p.value;
          if (verified) applied.push(`logged ${p.value} for habit "${habit.title}"`);
          else fail(p, `The value for habit "${habit.title}" was not retained in the database.`);
        }
      } else if (p.kind === "addShutdownRitual") {
        const before = new Set(state.shutdownRituals.map((r) => r.id));
        await state.addShutdownRitual(p.title);
        await refresh();
        const created = useStore
          .getState()
          .shutdownRituals.find((r) => !before.has(r.id) && r.title === p.title.trim());
        if (created) applied.push(`added shutdown ritual "${created.title}"`);
        else fail(p, `The shutdown ritual "${p.title}" was not found after saving.`);
      } else if (p.kind === "deleteShutdownRitual" || p.kind === "toggleShutdownRitual") {
        const resolved = resolveNamed(
          state.shutdownRituals,
          p.find,
          (r) => r.title,
          "shutdown ritual"
        );
        if (!resolved.value) {
          fail(p, resolved.error ?? `Shutdown ritual "${p.find}" was not found.`);
          continue;
        }
        const ritual = resolved.value;
        if (p.kind === "deleteShutdownRitual") {
          await state.deleteShutdownRitual(ritual.id);
          await refresh();
          if (!useStore.getState().shutdownRituals.some((r) => r.id === ritual.id)) {
            applied.push(`deleted shutdown ritual "${ritual.title}"`);
          } else {
            fail(p, `The shutdown ritual "${ritual.title}" still exists after deletion.`);
          }
        } else {
          const wasChecked = state.shutdownChecks.some(
            (c) => c.ritual_id === ritual.id && c.day === today
          );
          await state.toggleShutdownCheck(ritual.id, today);
          await refresh();
          const isChecked = useStore
            .getState()
            .shutdownChecks.some((c) => c.ritual_id === ritual.id && c.day === today);
          if (isChecked !== wasChecked) {
            applied.push(`${isChecked ? "checked" : "unchecked"} shutdown ritual "${ritual.title}"`);
          } else {
            fail(p, `The shutdown ritual "${ritual.title}" did not change.`);
          }
        }
      } else if (p.kind === "startFocusTimer") {
        let taskId: string | undefined;
        let taskTitle: string | undefined;
        if (p.taskFind) {
          const task = resolveNamed(state.tasks, p.taskFind, (t) => t.title, "task");
          if (!task.value) {
            fail(p, task.error ?? `Task "${p.taskFind}" was not found.`);
            continue;
          }
          taskId = task.value.id;
          taskTitle = task.value.title;
        }
        if (p.durationMin) state.setFocusMin(p.durationMin);
        if (taskId) state.startFocusFor(taskId);
        else state.startPomo();
        const pomo = useStore.getState().pomo;
        const verified =
          pomo.running &&
          (!taskId || pomo.taskId === taskId) &&
          (!p.durationMin || pomo.focusMin === p.durationMin);
        if (verified) {
          applied.push(
            taskTitle
              ? `started focus timer for "${taskTitle}"`
              : `started focus timer (${p.durationMin ?? pomo.focusMin} min)`
          );
        } else {
          fail(p, "The focus timer did not enter the requested running state.");
        }
      } else if (p.kind === "stopFocusTimer") {
        if (p.action === "reset") state.resetPomo();
        else state.pausePomo();
        const pomo = useStore.getState().pomo;
        const verified =
          !pomo.running &&
          (p.action !== "reset" || (pomo.phase === "focus" && pomo.rounds === 0));
        if (verified) applied.push(`${p.action === "reset" ? "reset" : "paused"} focus timer`);
        else fail(p, `The focus timer was not ${p.action === "reset" ? "reset" : "paused"}.`);
      } else if (p.kind === "saveDailyNote") {
        const noteDay = p.day || today;
        await state.saveDailyNote(noteDay, p.content);
        await refresh();
        const note = useStore.getState().dailyNotes.find((n) => n.day === noteDay);
        if (note?.content === p.content) applied.push(`saved daily note for ${noteDay}`);
        else fail(p, `The daily note for ${noteDay} was not retained in the database.`);
      } else if (p.kind === "updateUserProfile") {
        await state.setProfile(p.profile);
        if (useStore.getState().profile === p.profile) {
          applied.push("updated your profile information");
        } else {
          fail(p, "The profile update was not retained.");
        }
      }
    } catch (error) {
      fail(
        p,
        `${describeProposal(p)} failed: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
  }

  return { applied, failed };
};

// Runs one turn, verifies every requested mutation, and asks the model to repair
// bad tool arguments only when the previous attempt changed nothing.
export const runAgentTurn = async (history: AgentMessage[]): Promise<string> => {
  const actionRequested = isDataActionRequest(history);
  let attemptHistory = history;
  let lastFailures = ["No verified change was made."];
  let repairDetails = lastFailures.join(" ");

  for (let attempt = 1; attempt <= MAX_ACTION_ATTEMPTS; attempt++) {
    const reply = await chatWithTools(attemptHistory, buildContext());

    if (reply.toolCalls?.length) {
      const { proposals, note } = proposalsFromToolCalls(
        reply.toolCalls,
        useStore.getState().blocks
      );
      if (proposals.length) {
        const result = await executeProposals(proposals);
        if (result.applied.length) {
          // Do not retry a partial batch: repeating successful create actions could duplicate data.
          return formatExecutionResult(result);
        }
        lastFailures = result.failed.map((f) => f.reason);
        repairDetails = lastFailures.join(" ");
      } else {
        const calls = reply.toolCalls
          .map((call) => `${call.name}(${JSON.stringify(call.args)})`)
          .join(", ");
        lastFailures = [note ?? "The requested action details were invalid."];
        repairDetails = `${lastFailures.join(" ")} Attempted tool calls: ${calls}.`;
      }
    } else if (!actionRequested) {
      return reply.text ?? "";
    } else {
      lastFailures = ["The requested action could not be executed, so no app data was changed."];
      repairDetails = "The model returned no tool call for the requested data action.";
    }

    if (attempt === MAX_ACTION_ATTEMPTS) break;

    attemptHistory = [
      ...history,
      {
        role: "assistant",
        content: "I could not verify any change from that attempt.",
      },
      {
        role: "user",
        content:
          "Internal execution feedback: nothing was changed. " +
          `Failures: ${repairDetails} ` +
          "Retry the original request using corrected tool arguments and exact current names from the user data. " +
          "Do not claim success in text; make the tool call only.",
      },
    ];
  }

  return `I couldn't make that change after ${MAX_ACTION_ATTEMPTS} attempts. ${lastFailures.join(" ")}`;
};
