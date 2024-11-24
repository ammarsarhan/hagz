import Button from "@/components/ui/Button";
import { useFormContext } from "@/context/useFormContext";

export default function FormWrapper () {
    const context = useFormContext();

    const labels = [
        {title: "Create a free account", subtitle: "We'll need some information to get you up and running."},
        {title: "More details", subtitle: "Help us tailor content and recommendations to better suit your preferences and interests."},
        {title: "Set up security", subtitle: "Let's secure your account by providing a password and setting up 2-factor authentication."},
        {title: "Verify details", subtitle: 
            context.data.emailStatus == "Verified" ? 
            "Congratulations! Your email has been verified successfully." : 
            "An email has been sent to the provided email address, follow steps to verify your account."
        },
        {title: "Create or link pitch", subtitle: "Give us information about your pitch or link an existing pitch."},
        {title: "Create pitch (continued)", subtitle: "Start adding spice to your pitch! What makes your pitch unique?"},
        {title: "Congratulations!", subtitle: "Your account has been created successfully. You can now recieve reservations!"}
    ]

    return (
        <div className="w-full h-full flex-center flex-col gap-y-4 lg:bg-white">
            <span className="text-red-600 text-sm">{context.properties.error}</span>
            <div className="flex-center flex-col gap-y-2 text-center w-4/5">
                <h1 className="text-2xl font-medium">{labels[context.properties.currentIndex].title}</h1>
                <h6 className="text-sm text-dark-gray">{labels[context.properties.currentIndex].subtitle}</h6>
            </div>
            {
                context.properties.steps[context.properties.currentIndex]
            }
            {
                <div className="flex gap-x-4">
                    {
                        context.properties.renderBack &&
                        <Button variant="primary" className="!px-20" onClick={context.actions.back} type="button">Back</Button>
                    }
                    {
                        context.properties.renderNext &&
                        <Button variant={context.properties.pending ? "pending" : "color"} className="!px-20" type="submit">
                            Next
                        </Button>
                    }
                </div>
            }
        </div>
    )
}