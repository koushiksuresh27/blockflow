import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
}

type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'ADD':    return [action.toast, ...state].slice(0, 5); // max 5 stacked
    case 'REMOVE': return state.filter((t) => t.id !== action.id);
    default:       return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toast: (variant: ToastVariant, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
    clearTimeout(timerRefs.current.get(id));
    timerRefs.current.delete(id);
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      const id = crypto.randomUUID();
      dispatch({ type: 'ADD', toast: { id, variant, title, message } });
      const timer = setTimeout(() => remove(id), 4500);
      timerRefs.current.set(id, timer);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.toast;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { wrapper: string; icon: ReactNode }> = {
  success: {
    wrapper: 'bg-white border-green-200 shadow-green-100',
    icon: <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-px" />,
  },
  error: {
    wrapper: 'bg-white border-red-200 shadow-red-100',
    icon: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-px" />,
  },
  info: {
    wrapper: 'bg-white border-blue-200 shadow-blue-100',
    icon: <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-px" />,
  },
};

// ─── Container ───────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 w-80 pointer-events-none"
    >
      {toasts.map((t) => {
        const { wrapper, icon } = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="alert"
            className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-lg pointer-events-auto
              animate-[slideInRight_0.2s_ease-out] ${wrapper}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-snug">{t.title}</p>
              {t.message && (
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{t.message}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="p-0.5 rounded hover:bg-gray-100 transition flex-shrink-0 mt-px"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
