export default function ProfileAvatar({ iniital } : { iniital: string }) {
    return (
        <div className="flex-center rounded-full text-sm w-8 h-8 border-[1px] cursor-pointer">
            {iniital}
        </div>
    )
}