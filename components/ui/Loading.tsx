import { LoaderCircle } from "lucide-react"

export default function Loading () {
    return <div><LoaderCircle className="w-6 h-6 text-dark-gray animate-spin" style={{animationDuration: '2s'}}/></div>
}