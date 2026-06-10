import { useState } from 'react';
import { TbChevronDown, TbCheck } from 'react-icons/tb';

interface AreaOption {
    value: string;
    label: string;
}

interface AreaGroup {
    value: string;
    label: string;
    options: AreaOption[];
}

interface AreaAccordionProps {
    groups: AreaGroup[];
    value: string;
    onChange: (value: string) => void;
}

export default function AreaAccordion({ groups, value, onChange }: AreaAccordionProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    const group = groups.find(g => g.options.some(o => o.value === value));
    return group?.value ?? null;
  });

  const toggleGroup = (groupValue: string) => {
    setOpenGroup(prev => (prev === groupValue ? null : groupValue));
  };

  return (
    <div className='flex flex-col gap-y-1'>
      {
        groups.map(group => {
            const isOpen = openGroup === group.value;
            const selectedInGroup = group.options.find(o => o.value === value);

            return (
                <div key={group.value} className='flex flex-col'>
                    <div
                        onClick={() => toggleGroup(group.value)}
                        className='flex items-center justify-between hover:bg-gray-100 cursor-pointer rounded-md p-4 transition-all'
                    >
                    <div className='flex flex-col'>
                        <h3 className='text-sm font-medium'>
                            {group.label}
                            {selectedInGroup && (
                                <span className='ml-2 text-primary-muted font-normal'>
                                — {selectedInGroup.label}
                                </span>
                            )}
                        </h3>
                        <span className='text-[0.8125rem] text-gray-500'>
                            ({group.options.length} areas)
                        </span>
                    </div>
                    <TbChevronDown
                        className={`size-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                    </div>
                    {
                        isOpen && (
                            <div className='mb-2 rounded-md grid grid-cols-2 overflow-hidden'>
                                {
                                    group.options.map((option, index) => {
                                        const isSelected = option.value === value;
                                        const totalItems = group.options.length;
                                        const isLastRow = index >= totalItems - 2;

                                        return (
                                            <div
                                                key={option.value}
                                                onClick={() => onChange(option.value)}
                                                className={`
                                                    flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors text-sm
                                                    ${isSelected ? 'bg-primary-muted/10 text-primary-muted' : 'hover:bg-gray-50 text-gray-700'}
                                                    ${index % 2 === 0 ? "border-r border-gray-100" : ""}
                                                    ${!isLastRow ? 'border-b border-gray-100' : ''}
                                                `}
                                            >
                                                <span>{option.label}</span>
                                                {isSelected && <TbCheck className='size-4 text-primary-muted' />}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        )
                    }
                </div>
            );
        })
      }
    </div>
  );
}