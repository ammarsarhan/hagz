import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { InputGroup, InputGroupContainer } from "@/components/input";
import { AmenityFilterType, GroundSizeFilterType, GroundSurfaceFilterType, useFilterContext } from "@/context/filter";
import Button from "@/components/button";
import { Check, ChevronDown, X } from "lucide-react";

const Day = () => {
    const { temp, setTemp } = useFilterContext();
    const now = new Date();
  
    const handleStartTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
      const time = e.target.value;
      const hour = time.split(":")[0];
      const parsed = `${hour}:00`;
      
      setTemp({...temp, startTime: parsed});
    }
  
    const handleEndTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
      const time = e.target.value;
      const hour = time.split(":")[0];
      const parsed = `${hour}:00`;
  
      setTemp({...temp, endTime: parsed});
    }
  
    return (
      <div className="flex flex-col gap-y-6">
        <InputGroup className="text-sm" label={"Select Date"} type="date" placeholder={"Day"} value={temp.targetDate} onChange={(e) => setTemp({...temp, targetDate: e.target.value})} min={now.toISOString()}/>
        <InputGroupContainer>
          <InputGroup className="text-sm" label={"Start Time"} type="time" placeholder={"Start Time"} value={temp.startTime} onChange={handleStartTimeChange} onClear={() => setTemp({...temp, startTime: ""})}/>
          <InputGroup className="text-sm" label={"End Time"} type="time" placeholder={"End Time"} value={temp.endTime} onChange={handleEndTimeChange} onClear={() => setTemp({...temp, endTime: ""})}/>
        </InputGroupContainer>
      </div>
    )
}

const Price = () => {
    const { temp, setTemp } = useFilterContext();

    const onMinChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        setTemp({...temp, minimumPrice: value});
      }
      
      const onMaxChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        setTemp({...temp, maximumPrice: value});
      }

    return (
        <div>
            <InputGroupContainer>
                <InputGroup className="text-sm" label={"Min Price"} type="number" placeholder={"Min Price"} min={"100"} max={"900"} value={String(temp.minimumPrice)} onChange={onMinChange}/>
                <InputGroup className="text-sm" label={"Max Price"} type="number" placeholder={"Max Price"} min={"200"} max={"1000"} value={String(temp.maximumPrice)} onChange={onMaxChange}/>
            </InputGroupContainer>
        </div>
    )
}

const Location = () => {
    const { temp, setTemp, data } = useFilterContext();
  
    const onChange = (e: ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      setTemp({...temp, searchRadius: value == 0 ? null : value});
    }
  
    const isLocation = data.location.latitude && data.location.longitude;
  
    return (
      <div className="flex flex-col gap-y-6">
        <div className="flex items-center justify-between gap-x-8">
          <div className="text-sm">
            <span>Search Radius</span>
            <p className="text-gray-500 text-[0.825rem]">(Between 1 to 10 KMs)</p>
          </div>
          <input type="number" min={1} max={10} placeholder="Radius (in KMs)" className="border-b-[1px] text-sm px-2 py-1 w-36 outline-none" value={temp.searchRadius || ""} onChange={onChange}/>
        </div>
        <div className="flex items-center justify-between gap-x-8 text-sm">
          <span>Pin location: {isLocation ? `${data.location.longitude?.toFixed(2)}, ${data.location.latitude?.toFixed(2)}` : "N/A"}</span>
        </div>
      </div>
    )
}

const Ground = () => {
    const { temp, setTemp } = useFilterContext();

    const isFive = temp.groundSize.includes('5-a-side');
    const isSeven = temp.groundSize.includes('7-a-side');
    const isEleven = temp.groundSize.includes('11-a-side');

    const isArtificial = temp.groundSurface.includes('Artificial Grass');
    const isNatural = temp.groundSurface.includes('Natural Grass');

    const handleSelectSize = (size: GroundSizeFilterType) => {
        if (temp.groundSize.includes(size)) {
          const updated = temp.groundSize.filter((item) => item !== size);
          setTemp({...temp, groundSize: updated});
        } else {
          setTemp({...temp, groundSize: [...temp.groundSize, size]});
        }
    };
    
    const handleSelectSurface = (surface: GroundSurfaceFilterType) => {
        if (temp.groundSurface.includes(surface)) {
          setTemp({...temp, groundSurface: temp.groundSurface.filter((item) => item !== surface)});
        } else {
          setTemp({...temp, groundSurface: [...temp.groundSurface, surface]});
        }
      }

    return (
        <div className="flex flex-col gap-y-8">
            <div className="flex flex-col gap-y-2">
                <span className="text-sm text-gray-500 mb-2">Ground Size</span>
                <button className={`flex items-center justify-between gap-x-4 border-[1px] py-3 px-5 text-sm ${isFive ? "bg-gray-100" : ""}`} onClick={() => handleSelectSize('5-a-side')}>
                    <span>5-a-side</span>
                    {
                        isFive && <Check className="w-4 h-4 text-gray-500"/>
                    }
                </button>
                <button className={`flex items-center justify-between gap-x-4 border-[1px] py-3 px-5 text-sm ${isSeven ? "bg-gray-100" : ""}`} onClick={() => handleSelectSize('7-a-side')}>
                    <span>7-a-side</span>
                    {
                        isSeven && <Check className="w-4 h-4 text-gray-500"/>
                    }
                </button>
                <button className={`flex items-center justify-between gap-x-4 border-[1px] py-3 px-5 text-sm ${isEleven ? "bg-gray-100" : ""}`} onClick={() => handleSelectSize('11-a-side')}>
                    <span>11-a-side</span>
                    {
                        isEleven && <Check className="w-4 h-4 text-gray-500"/>
                    }
                </button>
            </div>
            <div className="flex flex-col gap-y-2">
                <span className="text-sm text-gray-500 mb-2">Ground Surface</span>
                <button className={`flex items-center justify-between gap-x-4 border-[1px] py-3 px-5 text-sm ${isArtificial ? "bg-gray-100" : ""}`} onClick={() => handleSelectSurface('Artificial Grass')}>
                    <span>Artificial Grass</span>
                    {
                        isArtificial && <Check className="w-4 h-4 text-gray-500"/>
                    }
                </button>
                <button className={`flex items-center justify-between gap-x-4 border-[1px] py-3 px-5 text-sm ${isNatural ? "bg-gray-100" : ""}`} onClick={() => handleSelectSurface('Natural Grass')}>
                    <span>Natural Grass</span>
                    {
                        isNatural && <Check className="w-4 h-4 text-gray-500"/>
                    }
                </button>
            </div>
        </div>
    )
}

const AmenityButton = ({ label } : { label: AmenityFilterType }) => {
    const { temp, setTemp } = useFilterContext();
    const baseStyle = "text-sm px-3 py-2 border-[1px]";
  
    const addAmenity = () => {
      const updated = [...temp.amenities];
      updated.push(label);
  
      setTemp({
        ...temp,
        amenities: updated
      });
    };
  
    const removeAmenity = () => {
      let updated = [...temp.amenities];
      updated = updated.filter((item) => item !== label);
  
      setTemp({
        ...temp,
        amenities: updated
      });
    }
  
    if (temp.amenities.includes(label)) {
      return (
        <button className={`${baseStyle} bg-gray-100`} onClick={removeAmenity}>
          {label}
        </button>
      )
    }
  
    return (
      <button className={baseStyle} onClick={addAmenity}>
        {label}
      </button>
    )
};

const Amenities = () => {  
    const labels = [
      "Indoors", "Ball Provided", "Seating", "Night Lights", "Parking", "Showers", "Changing Rooms", "Cafeteria", "First Aid", "Security"
    ] as AmenityFilterType[];
  
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-3">
            {
                labels.map((label, index) => {
                    return <AmenityButton label={label} key={index}/>
                })
            }
        </div>
    )
  }

export function FilterRow ({ label, row } : { label: string, row: ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex flex-col gap-y-8 border-b-[1px] border-gray-100! py-8">
            <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full">
                <span>
                    {label}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 ${open && "rotate-180"}`}/>
            </button>
            { open && row }
        </div>
    )
}

export default function Filter () {
    const { open, setOpen, temp, isChanged, reset, save, error, loading } = useFilterContext();
    const filter = useRef<HTMLDivElement | null>(null);

    const filters = [
        {
            label: `Date ${temp.targetDate != "" || temp.startTime != "" || temp.endTime != "" ? "*" : ""}`,
            row: <Day/>
        },
        {
            label: `Price ${temp.minimumPrice != 100 || temp.maximumPrice != 1000 ? "*" : ""}`,
            row: <Price/>
        },
        {
            label: `Location ${temp.searchRadius != null ? "*" : ""}`,
            row: <Location/>
        },
        {
            label: `Ground ${temp.groundSize.length != 3 || temp.groundSurface.length != 2 ? "*" : ""}`,
            row: <Ground/>
        },
        {
            label: `Amenities ${temp.amenities.length != 0 ? `(${temp.amenities.length})` : ""}`,
            row: <Amenities/>
        }
    ]

    useEffect(() => {
        if (error && filter.current != null) {
            filter.current.scrollTop = 0;
        };
    }, [error])

    if (open) {
        return (
            <div className="fixed top-0 left-0 z-50 h-screen w-screen bg-black/30">
                <div className="w-full md:w-96 bg-white h-full px-6 py-8 overflow-y-scroll" ref={filter}>
                    <div className="flex items-center justify-between gap-x-16 mb-6">
                        <span className="text-lg">Filters</span>
                        <button onClick={() => setOpen(false)}>
                            <X className="w-4 h-4 text-gray-500"/>
                        </button>
                    </div>
                    <p className="text-sm text-red-500 text-center">{error}</p>
                    <div className="flex-1 overflow-y-auto pb-16">
                        {
                            filters.map(({ label, row }, index) => {
                                return <FilterRow key={index} label={label} row={row}/>
                            })
                        }
                    </div>
                    <div className="flex-center gap-x-4 py-6 absolute bottom-0 left-0 w-full md:w-96 z-50 bg-white">
                        <Button 
                            variant="outline" 
                            className="px-6 py-3 text-xs"
                            onClick={reset}
                        >
                            Clear All
                        </Button>
                        <Button 
                            className="px-6 py-3 text-xs"
                            variant={(isChanged || loading) ? "primary" : "disabled"} 
                            disabled={!isChanged || loading}
                            onClick={save}
                        >
                            { loading ? "Loading..." : "Apply Changes" }
                        </Button>
                    </div>
                </div>
            </div>
        )
    }
}