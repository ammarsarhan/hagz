import Pulse from "@/components/pulse";
import { convertHourFormat } from "@/utils/date";

export interface TimeRowType {
    id: string,
    startTime: string,
    endTime: string
}

const TimeCell = ({ pair, available } : { pair : string[], available: boolean }) => {
    return (
        <div className="flex md:flex-col items-center justify-between gap-y-2 text-xs">
            <span className="text-gray-500 text-nowrap w-16 md:w-auto">{convertHourFormat(pair[0])}</span>
            {
                available ?
                <div className="h-5 w-5 rounded-md bg-gray-200 flex-1 md:flex-auto"></div> :
                <Pulse className="bg-blue-800 flex-1 md:flex-auto"/>
            }
            <span className="text-gray-500 text-nowrap text-right w-16 md:w-auto">{convertHourFormat(pair[1])}</span>
        </div>
    )
}

export default function TimeRows({ data } : { data: TimeRowType[] }) {
    const pairs = [
        ["00:00", "01:00"], ["01:00", "02:00"], ["02:00", "03:00"], ["03:00", "04:00"],
        ["04:00", "05:00"], ["05:00", "06:00"], ["06:00", "07:00"], ["07:00", "08:00"],
        ["08:00", "09:00"], ["09:00", "10:00"], ["10:00", "11:00"], ["11:00", "12:00"],
        ["12:00", "13:00"], ["13:00", "14:00"], ["14:00", "15:00"], ["15:00", "16:00"],
        ["16:00", "17:00"], ["17:00", "18:00"], ["18:00", "19:00"], ["19:00", "20:00"],
        ["20:00", "21:00"], ["21:00", "22:00"], ["22:00", "23:00"], ["23:00", "23:59"]
      ];
      
    const reserved: string[][] = [];

    data.forEach(item => {
        const [startHours] = item.startTime.split(":").map(Number);
        const [endHours, endMinutes] = item.endTime.split(":").map(Number);
        
        for (let i = startHours; i < endHours; i++) {
            reserved.push([
            `${String(i).padStart(2, "0")}:00`,
            `${String(i + 1).padStart(2, "0")}:00`
            ]);
        }
        
        if (endHours === 23 && endMinutes === 59) {
            reserved.push(["23:00", "23:59"]);
        }
    });
      
    return (
        <div className="flex flex-col gap-y-2">
            <div className="mb-2">
                <span className="text-sm">Key</span>
                <div className="flex items-center justify-center md:justify-normal gap-x-2 my-2">
                    <div className="w-5 h-5 rounded-md bg-blue-800"></div>
                    <span className="text-xs">Reserved</span>
                    <div className="w-5 h-5 rounded-md bg-gray-200 ml-4"></div>
                    <span className="text-xs">Available</span>
                </div>
            </div>
            <div className="grid grid-cols-[repeat(24, minmax(0, 1fr))] w-80 md:w-auto md:grid-cols-8 gap-y-6 gap-x-8">
                {
                    pairs.map((pair, index) => {
                        const match = reserved.find(item => item[0] === pair[0] && item[1] === pair[1]);

                        return (
                            <TimeCell 
                                key={index} 
                                pair={pair}
                                available={match ? false : true}
                            />
                        )
                    })
                }
            </div>
        </div>

    );
}
