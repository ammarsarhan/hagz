import { useState } from "react"

interface DropdownProps {
    options: string[]
    onSelect: (option: string) => void
}

export default function Dropdown ({ options, onSelect }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState('Select an option');

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const handleOptionClick = (option: string) => {
        setSelectedOption(option);
        setIsOpen(false);
        onSelect(option); // Call the onSelect function passed as a prop
    };

    return (
        <div className="dropdown">
            <button className="dropbtn" onClick={toggleDropdown}>
                {selectedOption}
            </button>
            {isOpen && (
                <div className="dropdown-content">
                    {options.map((option, index) => (
                        <a
                            key={index}
                            href="#!"
                            onClick={() => handleOptionClick(option)}
                        >
                            {option}
                        </a>
                    ))}
                </div>
            )}
        </div>
    )
}