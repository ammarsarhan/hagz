import { Star, Share, MoreHorizontal } from "lucide-react"
import Link from "next/link"

import Button from "@/components/ui/Button"
import Breadcrumbs from "@/components/ui/Breadcrumbs"
import Copyright from "@/components/ui/Copyright"
import Gallery from "@/components/Gallery"
import Reserve from "@/components/Reserve"
import Amenities from "@/components/Amenities"
import Card from "@/components/ui/Card"
 
const mock = [
    'https://images.pexels.com/photos/19582958/pexels-photo-19582958/free-photo-of-boys-playing-soccer-on-a-field.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'https://images.pexels.com/photos/16944016/pexels-photo-16944016/free-photo-of-football-pitches-in-town.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'https://images.pexels.com/photos/15914786/pexels-photo-15914786/free-photo-of-girls-playing-in-a-soccer-match.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'https://images.pexels.com/photos/9948672/pexels-photo-9948672.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'https://images.pexels.com/photos/12767212/pexels-photo-12767212.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
];

export default function Details () {
    return (
        <div className="px-5 pt-12 pb-6 sm:px-14 sm:pt-14 sm:pb-12">
            <Breadcrumbs labels={[{label: "Home", href: "/"}, {label: "Search", href: "/search"}, {label: "Details", href: "/details"}]}/>
            <header className="flex items-start justify-between mt-6">
                <div className="flex flex-col gap-y-5">
                    <h1 className="text-4xl font-semibold">El Nasr Club For Armed Forces</h1>
                    <h1 className="text-4xl font-semibold">(نادي النصر للقوات المسلحة)</h1>
                    <div className="flex items-center gap-x-3 text-dark-gray text-sm">
                        <span>Green Plaza, Smouha, Alexandria, Egypt</span>
                        <span>&middot;</span>
                        <div className="flex-center gap-x-1">
                            <Star className="w-4 h-4" stroke="orange" fill="orange"/>
                            <span>5</span>
                        </div>
                    </div>
                </div>
                <div className="hidden lg:flex gap-x-3">
                    <Button variant="primary" className="px-2">
                            <Share className="w-4 h-4"/>
                    </Button>
                    <Button variant="primary" className="px-2">
                            <MoreHorizontal className="w-4 h-4"/>
                    </Button>
                </div>
            </header>
            <main className="lg:grid grid-cols-details gap-8 my-8">
                <Reserve price={200} size={5}/>
                <div>
                    <Gallery title={"El Nasr Club For Armed Forces"} images={mock}/>
                    <div className="my-8">
                        <Amenities items={10}/>
                    </div>
                    <div className="my-8 lg:w-3/4">
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. Dolore similique eum dolores quaerat harum natus aliquid? Dolorem deserunt aut totam impedit saepe obcaecati delectus aliquam, provident tempora qui adipisci incidunt?</p>
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. Dolore similique eum dolores quaerat harum natus aliquid? Dolorem deserunt aut totam impedit saepe obcaecati delectus aliquam, provident tempora qui adipisci incidunt?</p>
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. Dolore similique eum dolores quaerat harum natus aliquid? Dolorem deserunt aut totam impedit saepe obcaecati delectus aliquam, provident tempora qui adipisci incidunt?</p>
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. Dolore similique eum dolores quaerat harum natus aliquid? Dolorem deserunt aut totam impedit saepe obcaecati delectus aliquam, provident tempora qui adipisci incidunt?</p>
                    </div>
                </div>
            </main>
            <div className="mt-16 mb-8 lg:my-4">
                <div className="flex items-center justify-between w-full">
                    <span className="text-lg">More pitches</span>
                    <Link href="/search" className="text-primary-green text-sm hover:text-tertiary-green">Find More</Link>
                </div>
                <div className="overflow-x-scroll whitespace-nowrap mt-6 [&>div]:mx-10 [&>*:first-child]:ml-4 [&>*:last-child]:mr-4">
                    {
                        Array(5).fill(<Card/>)
                    }
                </div>
            </div>
            <Copyright/>
        </div>
    )
}