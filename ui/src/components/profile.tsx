import { useAuthContext } from "@/context/auth";

export default function ProfileAvatar({ iniital } : { iniital: string }) {
    const { signOut } = useAuthContext();

    return (
        <div className="flex-center rounded-full text-sm w-8 h-8 border-[1px] cursor-pointer" onClick={async () => await signOut()}>
            {iniital}
        </div>
    )
}