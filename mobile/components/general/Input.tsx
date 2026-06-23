import { TextInput } from "react-native";

export default function Input({ placeholder } : { placeholder: string }) {
    return (
        <TextInput
            placeholder={placeholder}
            className="w-full border border-gray-300 py-3.5 px-3 rounded-md"
        />
    )
}