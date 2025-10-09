import { hideToast } from "@/lib/store/slices/uiSlice";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

export function ToastContainer() {
  const dispatch = useDispatch()
  const { toast } = useSelector((state) => state.ui);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (toast) {
      setProgress(100);

      // אורך חיי הטוסט
      const duration = 3000;

      // כל 30ms נעדכן את ההתקדמות
      const interval = setInterval(() => {
        setProgress((prev) => Math.max(prev - 100 / (duration / 30), 0));
      }, 30);

      // הסתרה אוטומטית אחרי 3 שניות
      const timer = setTimeout(() => {
        dispatch(hideToast());
      }, duration);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [toast, dispatch]);

  if (!toast) return null;

  const typeStyles = {
    success: "bg-green-500/90 border-green-400",
    error: "bg-red-500/90 border-red-400",
    warning: "bg-yellow-500/90 border-yellow-400",
    info: "bg-blue-500/90 border-blue-400",
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end space-y-2">
      <div
        key={toast.id}
        className={`
          relative flex flex-col justify-between w-80 p-4 text-white border rounded-xl shadow-lg overflow-hidden
          animate-slide-in-up animate-fade-in transition-all
          ${typeStyles[toast.type] || typeStyles.info}
        `}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => dispatch(hideToast())}
            className="ml-3 hover:opacity-80"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
          <div
            className="h-1 bg-white rounded-r-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
