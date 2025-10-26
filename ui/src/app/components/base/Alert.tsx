"use client";

import { useEffect } from "react";
import { IoIosCheckmarkCircleOutline, IoIosClose, IoIosInformationCircleOutline } from "react-icons/io";
import { IoCloseCircleOutline, IoWarningOutline } from "react-icons/io5";

type AlertProps = {
  type?: "success" | "error" | "info" | "warning";
  message: string;
  onClose: () => void;
  duration?: number;
};

export default function Alert({ type = "info", message, onClose, duration = 3500 }: AlertProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: <IoIosCheckmarkCircleOutline className="size-4.5 flex-shrink-0 mr-4 text-green-600" />,
    error: <IoCloseCircleOutline className="size-5 flex-shrink-0 mr-4 text-red-500" />,
    info: <IoIosInformationCircleOutline className="size-5 flex-shrink-0 mr-4 text-blue-700" />,
    warning: <IoWarningOutline className="size-5 flex-shrink-0 mr-4 text-yellow-500" />,
  };

  return (
    <div
      className={`z-999 fixed top-4 right-4 flex items-center max-w-sm px-4 py-3 rounded-md shadow-lg border bg-gray-50 border-gray-200 animate-fade-in`}
    >
      {icons[type]}
      <p className="text-[0.8rem] font-medium text-gray-700">{message}</p>
      <button onClick={onClose} className="ml-3 hover:opacity-70 cursor-pointer">
        <IoIosClose className="flex-shrink-0 size-5 text-gray-500"/>
      </button>
    </div>
  );
}
