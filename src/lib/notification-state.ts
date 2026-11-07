export const NOTICE_DURATION_MS = 3500;

export function formatNoticeMessage(message: string) {
  const text = message.trim();
  if (!/[。.]$/.test(text)) return text;
  const sentence = text.slice(0, -1);
  return /[。！？!?]|\.(?=\s|$)/.test(sentence) ? text : sentence;
}

export type NoticeKind = "info" | "success" | "warning" | "error";
export type Notice = {
  id: string;
  owner: string;
  key: string;
  kind: NoticeKind;
  message: string;
};
export type NotificationState = {
  notice: Notice | null;
  tasks: Notice[];
  blocked: boolean;
};
export type NotificationAction =
  | { type: "show"; notice: Notice }
  | { type: "start"; notice: Notice }
  | { type: "finish"; owner: string; taskId: string; notice?: Notice }
  | { type: "expire"; id: string }
  | { type: "dismiss"; owner: string; key?: string }
  | { type: "block"; blocked: boolean };

export const INITIAL_NOTIFICATION_STATE: NotificationState = { notice: null, tasks: [], blocked: false };
const PRIORITY: Record<NoticeKind, number> = { info: 0, success: 1, warning: 2, error: 3 };

function showNotice(state: NotificationState, notice: Notice, taskResult = false): NotificationState {
  if (state.blocked) return state;
  const sameEvent = state.notice?.owner === notice.owner && state.notice.key === notice.key;
  if (!sameEvent && state.notice && PRIORITY[notice.kind] < PRIORITY[state.notice.kind]) return state;
  if (!taskResult && state.tasks.length && PRIORITY[notice.kind] < PRIORITY.warning) return state;
  return { ...state, notice };
}

export function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "show":
      return showNotice(state, action.notice);
    case "start":
      return {
        ...state,
        notice: state.notice && (state.notice.owner !== action.notice.owner || state.notice.key !== action.notice.key)
          && PRIORITY[state.notice.kind] >= PRIORITY.warning ? state.notice : null,
        tasks: [...state.tasks.filter((task) => task.owner !== action.notice.owner || task.key !== action.notice.key), action.notice],
      };
    case "finish": {
      const task = state.tasks.find((task) => task.id === action.taskId && task.owner === action.owner);
      if (!task) return state;
      const next = { ...state, tasks: state.tasks.filter((task) => task.id !== action.taskId) };
      return action.notice ? showNotice(next, { ...action.notice, key: task.key }, task === state.tasks.at(-1)) : next;
    }
    case "expire":
      return state.notice?.id === action.id ? { ...state, notice: null } : state;
    case "dismiss": {
      const matches = (notice: Notice) => notice.owner === action.owner && (action.key === undefined || notice.key === action.key);
      return {
        ...state,
        notice: state.notice && matches(state.notice) ? null : state.notice,
        tasks: state.tasks.filter((task) => !matches(task)),
      };
    }
    case "block":
      return state.blocked === action.blocked ? state : { ...state, blocked: action.blocked, notice: action.blocked ? null : state.notice };
  }
}

export function getVisibleNotification(state: NotificationState) {
  return state.blocked ? null : state.notice ?? state.tasks.at(-1) ?? null;
}
