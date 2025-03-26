"use client";

import { ChangeEvent } from "react";
import { InputGroup, InputGroupContainer, InputRange } from "@/components/input";
import Filter from "@/components/filter";
import FilterContextProvider, { AmenityFilterType, FilterSlideType, GroundSizeFilterType, GroundSurfaceFilterType, useFilterContext } from "@/context/filter";
import { CircleDollarSign } from "lucide-react";

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
    <div className="flex flex-col gap-y-6 py-2">
      <InputGroup label={"Select Date"} type="date" placeholder={"Day"} value={temp.targetDate} onChange={(e) => setTemp({...temp, targetDate: e.target.value})} min={now.toISOString()}/>
      <InputGroupContainer>
        <InputGroup label={"Start Time"} type="time" placeholder={"Start Time"} value={temp.startTime} onChange={handleStartTimeChange} onClear={() => setTemp({...temp, startTime: ""})}/>
        <InputGroup label={"End Time"} type="time" placeholder={"End Time"} value={temp.endTime} onChange={handleEndTimeChange} onClear={() => setTemp({...temp, endTime: ""})}/>
      </InputGroupContainer>
    </div>
  )
};

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
    <div className="flex flex-col gap-y-4 py-2 border-b-[1px]">
      <span className="text-sm">Price Range</span>
      <div className="w-full flex items-center justify-between gap-x-16 bg-gray-100 rounded-full border-[1px] text-sm">
        <div className="flex items-center gap-x-2 flex-1 py-2 px-4 bg-white rounded-full shadow">
          <CircleDollarSign className="w-4 h-4 text-gray-500"/>
          Min: {temp.minimumPrice} EGP
        </div>
        <div className="flex items-center gap-x-2 flex-1 py-2 px-4 bg-white rounded-full shadow">
          <CircleDollarSign className="w-4 h-4 text-gray-500"/>
          Max: {temp.maximumPrice} EGP
        </div>
      </div>
      <InputRange 
        minimum={100} 
        maximum={1000} 
        minValue={temp.minimumPrice} 
        maxValue={temp.maximumPrice} 
        onMinChange={onMinChange}
        onMaxChange={onMaxChange}
        className="mt-4 mb-6"
      />
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
    <div className="mt-2 flex flex-col gap-y-4">
      <div className="flex items-center justify-between gap-x-8">
        <div className="text-sm">
          <span>Search Radius</span>
          <p className="text-gray-500 text-[0.825rem]">(Between 1 to 10 KMs)</p>
        </div>
        <input type="number" min={1} max={10} placeholder="Radius (in KMs)" className="border-b-[1px] text-sm px-2 py-1 w-36" value={temp.searchRadius || ""} onChange={onChange}/>
      </div>
      <div className="flex items-center justify-between gap-x-8 text-sm">
        <span>Pin location: {isLocation ? `${data.location.longitude}, ${data.location.latitude}` : "N/A"}</span>
      </div>
    </div>
  )
}

const Ground = () => {
  const { temp, setTemp } = useFilterContext();

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
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between gap-x-8 mt-2">
        <div className="text-sm">
          <span>Ground Size</span>
          <p className="text-gray-500 text-[0.825rem]">(Five, Seven, or Eleven)</p>
        </div>
        <div>
          <div className="text-sm flex items-center gap-x-2">
            <input type="checkbox" checked={temp.groundSize.includes('5-a-side')} onChange={() => handleSelectSize("5-a-side")}/>
            <label>5-a-side</label>
          </div>
          <div className="text-sm flex items-center gap-x-2">
            <input type="checkbox" checked={temp.groundSize.includes('7-a-side')} onChange={() => handleSelectSize("7-a-side")}/>
            <label>7-a-side</label>
          </div>
          <div className="text-sm flex items-center gap-x-2">
            <input type="checkbox" checked={temp.groundSize.includes('11-a-side')} onChange={() => handleSelectSize("11-a-side")}/>
            <label>11-a-side</label>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-x-8 mt-2">
        <div className="text-sm">
          <span>Ground Surface</span>
          <p className="text-gray-500 text-[0.825rem]">(Artificial or Natural)</p>
        </div>
        <div>
          <div className="text-sm flex items-center gap-x-2">
            <input type="checkbox" checked={temp.groundSurface.includes('Artificial Grass')} onChange={() => handleSelectSurface('Artificial Grass')}/>
            <label>Artificial Grass</label>
          </div>
          <div className="text-sm flex items-center gap-x-2">
            <input type="checkbox" checked={temp.groundSurface.includes('Natural Grass')} onChange={() => handleSelectSurface('Natural Grass')}/>
            <label>Natural Grass</label>
          </div>
        </div>
      </div>
    </div>
  )
}

const AmenityButton = ({ label } : { label: AmenityFilterType }) => {
  const { temp, setTemp } = useFilterContext();
  const baseStyle = "text-sm px-3 py-1 border-[1px] rounded-md";

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
}

const Amenities = () => {
  const { temp } = useFilterContext();

  const labels = [
    "Indoors", "Ball Provided", "Seating", "Night Lights", "Parking", "Showers", "Changing Rooms", "Cafeteria", "First Aid", "Security"
  ] as AmenityFilterType[];

  return (
    <div className="mt-2 flex flex-col gap-y-3">
      <span className="text-sm text-gray-500">Select Amenities ({temp.amenities.length}):</span>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-[1px] p-2 rounded-sm">
        {
          labels.map((label, index) => {
            return <AmenityButton label={label} key={index}/>
          })
        }
      </div>
    </div>
  )
}

export default function SearchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const slides = [
    {
      name: "Day",
      component: <Day/>
    },
    {
      name: "Price",
      component: <Price/>
    },
    {
      name: "Location",
      component: <Location/>
    },
    {
      name: "Ground",
      component: <Ground/>
    },
    {
      name: "Amenities",
      component: <Amenities/>
    }
  ] as FilterSlideType[];

  return (
    <FilterContextProvider slides={slides}>
        <div className="flex flex-col h-screen">
            <Filter/>
            {children}
        </div>
    </FilterContextProvider>
  );
}
