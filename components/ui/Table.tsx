import Link from "next/link"

interface TableProps {
    headers: string[]
    data: string[][]
}

export default function Table ({headers, data} : TableProps) {
    return (
        <div className="text-sm table w-full">
            <div className="table-row text-dark-gray">
                {
                    headers.map((header, index) => (
                        <div key={index} className="hidden p-2 sm:table-cell first:table-cell last:table-cell border-b-[1px]">{header}</div>
                    ))
                }
            </div>
            {
                data.map((labels) => (
                    <div className="table-row hover:cursor-pointer hover:bg-gray-100 transition-all">
                        {
                            labels.map((label, index) => {
                                if (index === 0) {
                                    return (
                                        <div className="table-cell px-2 py-4 border-b-[1px]">
                                            <Link className='hover:underline hover:text-primary-green' href={"/"}>{label}</Link>
                                        </div>
                                    )
                                }
                                return (
                                    <div className="hidden sm:table-cell p-2 first:table-cell last:table-cell border-b-[1px]">
                                        {label}
                                    </div>
                                )
                            })
                        }
                    </div>
                ))
            }
        </div>
    )
}