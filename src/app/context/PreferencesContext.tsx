import { createContext, ReactNode, useEffect, useState } from "react";

// Come back to this with better type checking for preferences
export interface PreferencesType {
    firstName: string;
    role: string;
    locationPermission: boolean;
}

export interface PreferencesContextType {
    preferences: PreferencesType;
    updatePreferences: (newPreferences: Partial<PreferencesType>) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);
export default PreferencesContext;

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
    const [preferences, setPreferences] = useState<PreferencesType>({
        firstName: "",
        role: "user",
        locationPermission: false
    });

    const updatePreferences = (newPreferences: Partial<PreferencesType>) => {
        setPreferences((prevPreferences) => ({
          ...prevPreferences,
          ...newPreferences
        }));
    };

    useEffect(() => {
        // Load preferences from localStorage
        const savedPreferences = JSON.parse(localStorage.getItem('preferences') || "{}");
        savedPreferences && setPreferences(savedPreferences);
      }, []);
    
      useEffect(() => {
        // Save preferences to localStorage whenever they change
        localStorage.setItem('preferences', JSON.stringify(preferences));
      }, [preferences]);

    return (
        <PreferencesContext.Provider value={{preferences, updatePreferences}}>
            { children }
        </PreferencesContext.Provider>
    )
};