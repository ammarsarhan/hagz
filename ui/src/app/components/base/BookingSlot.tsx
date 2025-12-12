import { currencyFormat } from "@/app/utils/currency";
import { formatHour } from "@/app/utils/date";
import { getHours } from "date-fns";

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
  price: number;
  isPeakHour: boolean;
  isOffPeakHour: boolean;
  reason?: string;
};

type TimeSlotProps = {
  item: TimeSlot;
  index: number;
  onClick: (index: number) => void;
  isSelected: boolean;
  isAllowed: boolean;
}

export default function BookingSlot({ item, isSelected, isAllowed, onClick, index } : TimeSlotProps) {
  if (item.available) {
      return (
          <button 
              className={`
                  h-28 w-46 flex flex-col items-center justify-center gap-y-0.5 rounded-md border-[1px] 
                  ${isSelected ? "bg-blue-50 border-blue-700 cursor-pointer!" : "border-gray-200"} 
                  ${isAllowed ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"} 
                  transition-colors`
              }
              onClick={() => onClick(index)}
          >
              <span className={`${isSelected ? "text-blue-700" : "text-black"} transition-colors`}>{formatHour(getHours(item.startTime), true)} - {formatHour(getHours(item.endTime), true)}</span>
              <span className={`${isSelected ? "text-blue-700" : "text-gray-500"} transition-colors`}>{item.available ? "Available" : item.reason}</span>
              <span className={`${isSelected ? "text-blue-700" : "text-gray-500"} transition-colors`}>{currencyFormat.format(item.price)}</span>
          </button>
      )
  };
  
  return (
      <div className="h-28 w-46 flex flex-col items-center justify-center gap-y-0.5 rounded-md border-[1px] border-gray-200 cursor-not-allowed">
          <span>{formatHour(getHours(item.startTime), true)} - {formatHour(getHours(item.endTime), true)}</span>
          <span className="text-gray-500 text-center">{item.available ? "Available" : item.reason}</span>
      </div>
  )
}