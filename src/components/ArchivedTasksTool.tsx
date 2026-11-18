import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../store/useStore";
import { fmtDue } from "../utils/taskFormat";
import TaskDetailSheet from "./TaskDetailSheet";

const BG = "#141414";
const CARD = "#1A1A1A";
const LINE = "#262626";
const TEXT = "#FFFFFF";
const SUB = "#9C9C9C";
const ACCENT = "#FA6E1E";
const RED = "#E5484D";

const PAGE_SIZE = 15;

export default function ArchivedTasksTool() {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const refreshAll = useStore((s) => s.refreshAll);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [page, setPage] = useState(1);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // Directly retrieve archived/unwanted tasks (no inbox section)
  const archived = useMemo(() => {
    let list = tasks.filter((t) => t.status === "unwanted");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (sortBy === "newest") {
      list.sort((a, b) => b.created_at - a.created_at);
    } else if (sortBy === "oldest") {
      list.sort((a, b) => a.created_at - b.created_at);
    } else if (sortBy === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [tasks, query, sortBy]);

  // Paginated/infinite scroll slice
  const paginatedTasks = useMemo(() => {
    return archived.slice(0, page * PAGE_SIZE);
  }, [archived, page]);

  const loadMore = () => {
    if (paginatedTasks.length < archived.length) {
      setPage((p) => p + 1);
    }
  };

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === detailTaskId) ?? null;
  }, [tasks, detailTaskId]);

  return (
    <View style={styles.root}>
      {/* Search and Sort Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={SUB} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setPage(1);
            }}
            placeholder="Search archived tasks..."
            placeholderTextColor="#666666"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={16} color={SUB} />
            </Pressable>
          )}
        </View>

        <View style={styles.sortRow}>
          <Text style={styles.countText}>{archived.length} archived</Text>
          <View style={styles.sortChips}>
            {(["newest", "oldest", "title"] as const).map((s) => (
              <Pressable
                key={s}
                style={[styles.sortChip, sortBy === s && styles.sortChipActive]}
                onPress={() => setSortBy(s)}
              >
                <Text style={[styles.sortChipText, sortBy === s && styles.sortChipTextActive]}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Infinite Scroll List */}
      <FlatList
        data={paginatedTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="archive-outline" size={36} color="#444444" />
            <Text style={styles.emptyTitle}>No archived tasks</Text>
            <Text style={styles.emptySub}>
              Tasks marked unwanted or archived will show here. Tap any task to inspect details.
            </Text>
          </View>
        }
        renderItem={({ item: t }) => (
          <Pressable
            style={styles.taskCard}
            onPress={() => setDetailTaskId(t.id)}
            accessibilityRole="button"
            accessibilityLabel={`View details for ${t.title}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle} numberOfLines={2}>
                {t.title}
              </Text>
              <View style={styles.metaRow}>
                {t.due_date ? <Text style={styles.metaText}>Due: {fmtDue(t.due_date)}</Text> : null}
                {t.energy ? <Text style={styles.metaText}>Energy: {t.energy}</Text> : null}
              </View>
            </View>

            {/* Restore and Delete Buttons */}
            <View style={styles.actions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => updateTask(t.id, { status: "inbox" })}
                accessibilityRole="button"
                accessibilityLabel="Restore task"
              >
                <Ionicons name="refresh" size={18} color={ACCENT} />
                <Text style={styles.restoreText}>Restore</Text>
              </Pressable>

              <Pressable
                style={styles.actionBtn}
                onPress={() => deleteTask(t.id)}
                accessibilityRole="button"
                accessibilityLabel="Delete forever"
              >
                <Ionicons name="trash-outline" size={18} color={RED} />
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      {/* Task Detail Sheet */}
      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          onClose={() => setDetailTaskId(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: TEXT, fontSize: 14 },
  sortRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  countText: { color: SUB, fontSize: 13, fontWeight: "600" },
  sortChips: { flexDirection: "row", gap: 6 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
  },
  sortChipActive: { borderColor: ACCENT, backgroundColor: "rgba(250,110,30,0.15)" },
  sortChipText: { color: SUB, fontSize: 12, textTransform: "capitalize" },
  sortChipTextActive: { color: ACCENT, fontWeight: "700" },
  listContent: { padding: 16, paddingBottom: 50 },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  taskTitle: { color: TEXT, fontSize: 15, fontWeight: "600" },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  metaText: { color: SUB, fontSize: 12 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
  restoreText: { color: ACCENT, fontSize: 13, fontWeight: "600" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 20 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: "700", marginTop: 12 },
  emptySub: { color: SUB, fontSize: 13, textAlign: "center", marginTop: 4 },
});
