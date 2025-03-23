"use client";

import { ChangeEvent } from "react";
import { InputGroup, InputGroupContainer, InputRange } from "@/components/input";
import Filter from "@/components/filter";
import FilterContextProvider, { FilterSlideType, GroundSizeFilterType, GroundSurfaceFilterType, useFilterContext } from "@/context/filter";
import { CircleDollarSign } from "lucide-react";

const Date = () => {
  const { data, setData } = useFilterContext();

  const handleStartTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    const hour = time.split(":")[0];
    const parsed = `${hour}:00`;
    
    setData({...data, startTime: parsed});
  }

  const handleEndTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    const hour = time.split(":")[0];
    const parsed = `${hour}:00`;

    setData({...data, endTime: parsed});
  }

  return (
    <div className="flex flex-col gap-y-6 py-2">
      <InputGroup label={"Select Date"} type="date" placeholder={"Day"} value={data.targetDate} onChange={(e) => setData({...data, targetDate: e.target.value})} />
      <InputGroupContainer>
        <InputGroup label={"Start Time"} type="time" placeholder={"Start Time"} value={data.startTime} onChange={handleStartTimeChange} onClear={() => setData({...data, startTime: ""})}/>
        <InputGroup label={"End Time"} type="time" placeholder={"End Time"} value={data.endTime} onChange={handleEndTimeChange} onClear={() => setData({...data, endTime: ""})}/>
      </InputGroupContainer>
    </div>
  )
};

const Price = () => {
  const { data, setData } = useFilterContext();

  const onMinChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setData({...data, minimumPrice: value});
  }
  
  const onMaxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setData({...data, maximumPrice: value});
  }

  return (
    <div className="flex flex-col gap-y-4 py-2 border-b-[1px]">
      <span className="text-sm">Price Range</span>
      <div className="w-full flex items-center justify-between gap-x-16 bg-gray-100 rounded-full border-[1px] text-sm">
        <div className="flex items-center gap-x-2 flex-1 py-2 px-4 bg-white rounded-full shadow">
          <CircleDollarSign className="w-4 h-4 text-gray-500"/>
          Min: {data.minimumPrice} EGP
        </div>
        <div className="flex items-center gap-x-2 flex-1 py-2 px-4 bg-white rounded-full shadow">
          <CircleDollarSign className="w-4 h-4 text-gray-500"/>
          Max: {data.maximumPrice} EGP
        </div>
      </div>
      <InputRange 
        minimum={100} 
        maximum={1000} 
        minValue={data.minimumPrice} 
        maxValue={data.maximumPrice} 
        onMinChange={onMinChange}
        onMaxChange={onMaxChange}
        className="mt-4 mb-6"
      />
    </div>
  )
}

const Location = () => {
  const { data, setData } = useFilterContext();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);

    if (value >= 1 || value <= 10) {
      setData({...data, searchRadius: value});
    }
  }

  return (
    <div className="flex items-center justify-between gap-x-8 mt-2">
      <div className="text-sm">
        <span>Search Radius</span>
        <p className="text-gray-500 text-[0.825rem]">(Between 1 to 10 KMs)</p>
      </div>
      <input type="number" min={1} max={10} placeholder="Radius (in KMs)" className="border-b-[1px] text-sm px-2 py-1 w-30" value={data.searchRadius} onChange={onChange}/>
    </div>
  )
}

const Ground = () => {
  const { data, setData } = useFilterContext();

  const handleSelectSize = (size: GroundSizeFilterType) => {
    if (data.groundSize.includes(size)) {
      const temp = data.groundSize.filter((item) => item !== size);
      setData({...data, groundSize: temp});
    } else {
      setData({...data, groundSize: [...data.groundSize, size]});
    }
  };

  const handleSelectSurface = (surface: GroundSurfaceFilterType) => {
    if (data.groundSurface.includes(surface)) {
      setData({...data, groundSurface: data.groundSurface.filter((item) => item !== surface)});
    } else {
      setData({...data, groundSurface: [...data.groundSurface, surface]});
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
            <input type="checkbox" checked={data.groundSize.includes('5-a-side')} onChange={() => handleSelectSize("5-a-side")}/>
            <label>5-a-side</label>
          </div>
          <div className="text-sm flex items-center gap-x-2">
            <input type="checkbox" checked={data.groundSize.includes('7-a-side')} onChange={() => handleSelectSize("7-a-side")}/>
            <label>7-a-side</label>
          </div>
          <div className="text-sm flex items-center gap-x-2">
            <input type="checkbox" checked={data.groundSize.includes('11-a-side')} onChange={() => handleSelectSize("11-a-side")}/>
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
            <input type="checkbox" checked={data.groundSurface.includes('Artificial Grass')} onChange={() => handleSelectSurface('Artificial Grass')}/>
            <label>Artificial Grass</label>
          </div>
          <div className="text-sm flex items-center gap-x-2">
            <input type="checkbox" checked={data.groundSurface.includes('Natural Grass')} onChange={() => handleSelectSurface('Natural Grass')}/>
            <label>Natural Grass</label>
          </div>
        </div>
      </div>
    </div>
  )
}

const Amenities = () => {
  return (
    <div>
      amenities
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
      name: "Date",
      component: <Date/>
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
