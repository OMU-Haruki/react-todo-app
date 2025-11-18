import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faSortAmountDown,
  faMagnifyingGlass,
  faFlag,
  faCalendarDays,
  faTrash,
  faPen,
  faXmark,
  faCheck,
  faCircleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

type Priority = "high" | "medium" | "low";
type SortKey = "due" | "priority" | "created" | "title";

type Todo = {
  id: string;
  title: string;
  details: string;
  priority: Priority;
  dueDate: string;
  completed: boolean;
  createdAt: string;
};

type FormState = {
  title: string;
  details: string;
  priority: Priority;
  dueDate: string;
};

const priorityCopy: Record<Priority, { label: string; accent: string }> = {
  high: { label: "高", accent: "priority-high" },
  medium: { label: "中", accent: "priority-medium" },
  low: { label: "低", accent: "priority-low" },
};

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "due", label: "期限が早い順" },
  { value: "priority", label: "優先度が高い順" },
  { value: "created", label: "追加が新しい順" },
  { value: "title", label: "タイトル A→Z" },
];

const TODOS_STORAGE_KEY = "minimal-todo-radar.todos";

const seedTodos: Todo[] = [
  {
    id: uuid(),
    title: "モバイルUIスケッチ",
    details: "ホームタブの新しいヒーローセクション案を3つ描く",
    priority: "high",
    dueDate: dayjs().add(1, "day").format("YYYY-MM-DD"),
    completed: false,
    createdAt: dayjs().subtract(2, "day").toISOString(),
  },
  {
    id: uuid(),
    title: "リリースノート草案",
    details: "v1.4.0 の改善点を600字以内にまとめる",
    priority: "medium",
    dueDate: dayjs().add(3, "day").format("YYYY-MM-DD"),
    completed: false,
    createdAt: dayjs().subtract(1, "day").toISOString(),
  },
  {
    id: uuid(),
    title: "サーバー監視ルール見直し",
    details: "メモリ/CPU アラートのしきい値を再設定する",
    priority: "low",
    dueDate: dayjs().add(7, "day").format("YYYY-MM-DD"),
    completed: true,
    createdAt: dayjs().subtract(5, "day").toISOString(),
  },
];

const createEmptyForm = (): FormState => ({
  title: "",
  details: "",
  priority: "medium",
  dueDate: dayjs().add(1, "day").format("YYYY-MM-DD"),
});

const loadInitialTodos = (): Todo[] => {
  if (typeof window === "undefined") {
    return seedTodos;
  }

  try {
    const raw = window.localStorage.getItem(TODOS_STORAGE_KEY);
    if (!raw) {
      return seedTodos;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return seedTodos;
    }

    return parsed as Todo[];
  } catch (error) {
    console.warn("Failed to parse stored todos", error);
    return seedTodos;
  }
};

const App = () => {
  const [todos, setTodos] = useState<Todo[]>(loadInitialTodos);
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [searchTerm, setSearchTerm] = useState("");
  const [focusUrgentOnly, setFocusUrgentOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(createEmptyForm());

  const today = dayjs().startOf("day");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  const openModal = (todo?: Todo) => {
    if (todo) {
      setFormState({
        title: todo.title,
        details: todo.details,
        priority: todo.priority,
        dueDate: todo.dueDate,
      });
      setEditingId(todo.id);
    } else {
      setFormState(createEmptyForm());
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormState(createEmptyForm());
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }

    if (editingId) {
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === editingId
            ? {
                ...todo,
                title: formState.title.trim(),
                details: formState.details.trim(),
                priority: formState.priority,
                dueDate: formState.dueDate,
              }
            : todo
        )
      );
    } else {
      const newTodo: Todo = {
        id: uuid(),
        title: formState.title.trim(),
        details: formState.details.trim(),
        priority: formState.priority,
        dueDate: formState.dueDate,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setTodos((prev) => [...prev, newTodo]);
    }

    closeModal();
  };

  const toggleComplete = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const clearCompleted = () => {
    const hasCompleted = todos.some((todo) => todo.completed);
    if (!hasCompleted) {
      return;
    }

    const shouldProceed =
      typeof window === "undefined"
        ? true
        : window.confirm("完了済みのタスクをすべて削除しますか？");

    if (!shouldProceed) {
      return;
    }

    setTodos((prev) => prev.filter((todo) => !todo.completed));
  };

  const filterAndSort = useMemo(() => {
    const filtered = todos.filter((todo) => {
      const normalizedSearch = searchTerm.toLowerCase().trim();
      const matchesSearch = normalizedSearch
        ? todo.title.toLowerCase().includes(normalizedSearch) ||
          todo.details.toLowerCase().includes(normalizedSearch)
        : true;

      const dueDate = dayjs(todo.dueDate);
      const isOverdue = !todo.completed && dueDate.isBefore(today);
      const isDueSoon = !todo.completed && dueDate.diff(today, "day") <= 2;
      const isPriorityHigh = todo.priority === "high";

      const matchesFocus = focusUrgentOnly
        ? isOverdue || isDueSoon || isPriorityHigh
        : true;

      return matchesSearch && matchesFocus;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "due") {
        return dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf();
      }
      if (sortKey === "priority") {
        const priorityOrder: Record<Priority, number> = {
          high: 0,
          medium: 1,
          low: 2,
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sortKey === "created") {
        return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf();
      }
      return a.title.localeCompare(b.title);
    });

    return sorted;
  }, [todos, sortKey, searchTerm, focusUrgentOnly, today]);

  const stats = useMemo(() => {
    const total = todos.length;
    const done = todos.filter((todo) => todo.completed).length;
    const overdue = todos.filter(
      (todo) => !todo.completed && dayjs(todo.dueDate).isBefore(today)
    ).length;
    const upcoming = todos.filter(
      (todo) =>
        !todo.completed && dayjs(todo.dueDate).diff(today, "day") <= 3 &&
        dayjs(todo.dueDate).diff(today, "day") >= 0
    ).length;

    return { total, done, overdue, upcoming };
  }, [todos, today]);

  const modalTitle = editingId ? "タスクを編集" : "新しいタスク";

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Micro Planner</p>
          <h1>Minimal Todo Radar</h1>
          <p className="subtitle">
            集中のためのコンパクトなTodoアプリ
          </p>
        </div>
        <button className="primary" onClick={() => openModal()}>
          <FontAwesomeIcon icon={faPlus} />
          <span>タスクを追加</span>
        </button>
      </header>

      <section className="stats-grid">
        <article>
          <p>全タスク</p>
          <strong>{stats.total}</strong>
          <span>合計</span>
        </article>
        <article>
          <p>完了済み</p>
          <strong>{stats.done}</strong>
          <span>達成</span>
        </article>
        <article>
          <p>期限切れ</p>
          <strong>{stats.overdue}</strong>
          <span>至急対応</span>
        </article>
        <article>
          <p>3日以内</p>
          <strong>{stats.upcoming}</strong>
          <span>まもなく期限</span>
        </article>
      </section>

      <section className="toolbar">
        <label className="search-field">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input
            type="search"
            placeholder="タスクを検索"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="sort-field">
          <FontAwesomeIcon icon={faSortAmountDown} />
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={focusUrgentOnly}
            onChange={(event) => setFocusUrgentOnly(event.target.checked)}
          />
          <span>フォーカス</span>
        </label>

        <button
          type="button"
          className="ghost danger"
          onClick={clearCompleted}
          disabled={stats.done === 0}
        >
          <FontAwesomeIcon icon={faTrash} />
          完了を一括削除
        </button>
      </section>

      <section className="todo-grid">
        {filterAndSort.length === 0 ? (
          <div className="empty-state">
            <FontAwesomeIcon icon={faCircleExclamation} size="2x" />
            <p>表示できるタスクがありません</p>
            <button className="ghost" onClick={() => openModal()}>
              <FontAwesomeIcon icon={faPlus} />
              追加する
            </button>
          </div>
        ) : (
          filterAndSort.map((todo) => {
            const due = dayjs(todo.dueDate);
            const isOverdue = !todo.completed && due.isBefore(today);
            const daysDiff = due.diff(today, "day");
            const dueLabel = due.format("M/D (ddd)");
            const relative = due.from(today);

            return (
              <article
                key={todo.id}
                className={`todo-card ${todo.completed ? "done" : ""}`}
              >
                <header>
                  <span
                    className={`priority-pill ${priorityCopy[todo.priority].accent}`}
                  >
                    <FontAwesomeIcon icon={faFlag} />
                    {priorityCopy[todo.priority].label}
                  </span>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => toggleComplete(todo.id)}
                      aria-label={todo.completed ? "未完了に戻す" : "完了にする"}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => openModal(todo)}
                      aria-label="編集する"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => deleteTodo(todo.id)}
                      aria-label="削除する"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </header>

                <h2>{todo.title}</h2>
                {todo.details && <p>{todo.details}</p>}

                <footer>
                  <span
                    className={`due-chip ${
                      isOverdue ? "overdue" : daysDiff <= 2 ? "soon" : ""
                    }`}
                  >
                    <FontAwesomeIcon icon={faCalendarDays} />
                    {dueLabel}
                    <small>{relative}</small>
                  </span>
                </footer>
              </article>
            );
          })
        )}
      </section>

      {isModalOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header>
              <h3>{modalTitle}</h3>
              <button className="icon-button" onClick={closeModal}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>
            <form onSubmit={handleSubmit} className="modal-form">
              <label>
                タイトル
                <input
                  type="text"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="タスクの内容を入力"
                  required
                />
              </label>

              <label>
                内容
                <textarea
                  value={formState.details}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      details: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="補足やチェックポイントをメモ"
                />
              </label>

              <div className="form-row">
                <label>
                  優先度
                  <select
                    value={formState.priority}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        priority: event.target.value as Priority,
                      }))
                    }
                  >
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </label>

                <label>
                  期限
                  <input
                    type="date"
                    value={formState.dueDate}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        dueDate: event.target.value,
                      }))
                    }
                    min={dayjs().format("YYYY-MM-DD")}
                    required
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="ghost" onClick={closeModal}>
                  キャンセル
                </button>
                <button type="submit" className="primary">
                  {editingId ? "更新する" : "追加する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;