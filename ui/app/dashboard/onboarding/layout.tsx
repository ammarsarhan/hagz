import OnboardingProvider from "@/app/dashboard/onboarding/provider";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
    return (
        <OnboardingProvider>  
            {children}
        </OnboardingProvider>
    );
}