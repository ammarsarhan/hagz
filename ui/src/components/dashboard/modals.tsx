import { useState } from "react";
import { Text, Logs, Check, MapPin, Square, X, ArrowRight, ArrowLeft } from "lucide-react";

const First = () => {
    return (
        <div>

        </div>
    )
}

const Second = () => {
    return (
        <div>

        </div>
    )
}

const Third = () => {
    return (
        <div>

        </div>
    )
}

const Fourth = () => {
    return (
        <div>

        </div>
    )
}

const Fifth = () => {
    return (
        <div>
            
        </div>
    )
}

export function CreateModal ({ close } : { close : () => void }) {
    const [index, setIndex] = useState(0);

    const indicators = [
        {
            label: "General",
            icon: <Text className="w-4 h-4"/>
        },
        {
            label: "Location",
            icon: <MapPin className="w-4 h-4"/>
        },
        {
            label: "Advanced",
            icon: <Logs className="w-4 h-4"/>
        },
        {
            label: "Grounds",
            icon: <Square className="w-4 h-4"/>
        },
        {
            label: "Finalize",
            icon: <Check className="w-4 h-4"/>
        }
    ]

    const steps = [
        {
            title: "General Information",
            description: "To start off, we need some basic details about your pitch.",
            component: <First/>
        },
        {
            title: "Pitch Location",
            description: "Now, we need users to be able to locate your pitch. This information must be as precise as possible.",
            component: <Second/>
        },
        {
            title: "More Information",
            description: "This is where you can add more information about your pitch and change pitch settings.",
            component: <Third/>
        },
        {
            title: "Pitch Grounds",
            description: "Now, we need to know how many grounds you have and their details.",
            component: <Fourth/>
        },
        {
            title: "Congratulations!",
            description: "Your pitch has been created and added to Hagz successfully!",
            component: <Fifth/>
        }
    ];

    const back = () => {
        if (index != 0) {
            setIndex(prev => prev - 1);
        }
    }

    const next = () => {
        if (index != steps.length - 1) {
            setIndex(prev => prev + 1);
        }
    }

    const renderBack = index != 0;
    const renderNext = index < steps.length - 1;

    return (
        <div className="fixed flex-center top-0 left-0 z-50 h-screen w-screen bg-black/30">
            <div className="w-full md:w-3xl bg-white px-6 py-8 overflow-y-scroll text-sm rounded-sm">
                <div className="flex gap-x-1">
                    <div className="h-full pl-2 pr-8 py-8 border-r-[1px] flex flex-col gap-y-4">
                        {
                            indicators.map((indicator, i) => {
                                return (
                                    <div key={i} className="flex flex-col items-center gap-y-4">
                                        <div className={`flex items-center gap-x-2 ${i <= index ? "text-blue-800" : "text-gray-500"}`}>
                                            {indicator.icon}
                                            <span>{indicator.label}</span>
                                        </div>
                                        {
                                            i < indicators.length - 1 &&
                                            <div className={`w-[3px] h-16 rounded-md ${i < index ? "bg-blue-800 opacity-80" : "bg-gray-300"}`}></div>
                                        }
                                    </div>
                                )
                            })
                        }
                    </div>
                    <div className="flex flex-col items-center justify-between gap-y-4 my-2 flex-1 [&>div]:w-full">
                        <div className="flex items-start justify-between pl-4 pr-2">
                            <div>
                                <h1 className="mb-0.5">{steps[index].title}</h1>
                                <p className="text-gray-500">{steps[index].description}</p>
                            </div>
                            <button onClick={close}>
                                <X className="w-4 h-4 text-gray-500 hover:text-gray-700 transition-all"/>
                            </button>
                        </div>
                        <div>
                            
                        </div>
                        <div className="flex items-center justify-between px-4">
                            <button className={`flex items-center gap-x-1 ${renderBack ? "text-blue-800 hover:underline" : "text-gray-500 cursor-auto!"}`} disabled={!renderBack} onClick={back}>
                                <ArrowLeft className="w-4 h-4"/>
                                Go Back
                            </button>
                            <button className={`flex items-center gap-x-1 ${renderNext ? "text-blue-800 hover:underline" : "text-gray-500 cursor-auto!"}`} disabled={!renderNext} onClick={next}>
                                Next Step
                                <ArrowRight className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}