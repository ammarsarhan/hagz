import Button from "@/components/ui/Button";
import { Upload, X } from "lucide-react";
import { ChangeEvent, ReactNode, useState } from "react";

interface UploadModalProps {
    active: boolean;
    title?: string;
    label?: string;
    description?: ReactNode;
    closeModal: () => void,
}

export function UploadModal ({
        active, 
        title = "Upload Images",
        label = "Use a series of high quality, clear pictures to appeal to your user audience better.", 
        description = <>Select up to 4 images to show your pitch. <br/> The first image will be used as the primary image.</>, 
        closeModal
    } : UploadModalProps) {
    const [images, setImages] = useState<string[]>([]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files && e.target.files[0];
        if (file?.type.includes("image")) {
            setImages((prevImages) => {
                return [...prevImages, ];
            })
        }
    };

    if (active) {
        return (
            <div className="fixed flex-center w-full h-full top-0 left-0 bg-slate-900 bg-opacity-25 text-sm">
                <div className="sm:w-full md:w-2/3 lg:w-1/2 my-4 px-8 pt-10 pb-5 rounded-md bg-white overflow-y-scroll h-full sm:h-auto">
                    <div className="flex items-start justify-between gap-x-4 pb-6">
                        <div>
                            <h3 className="text-base font-medium mb-1">{title}</h3>
                            <p className="text-dark-gray">{label}</p>
                        </div>
                        <button onClick={closeModal} type="button"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="flex-center flex-col gap-y-1 h-[50vh] border-[1px] rounded-md mb-4">
                        <span className="font-medium">Drag and drop image files to upload</span>
                        <p className="text-dark-gray text-center">{description}</p>
                        <label htmlFor="file-upload" className="cursor-pointer border-[1px] border-light-gray text-primary-black hover:bg-gray-50 px-6 py-3 mt-3 rounded-full text-sm hover:bg-opacity-90 transition-all">
                            Select file(s)
                        </label>
                        <input id="file-upload" type="file" className="hidden" multiple onChange={e => handleFileChange(e)}/>
                    </div>
                </div>
            </div>
        )
    }

    return <></>
}

export default function UploadTrigger ({label = "Add Images", onClick} : {label?: string, onClick: () => void}) {
    return (
        <Button onClick={onClick} variant="primary" className="flex items-center gap-x-3 text-[0.8125rem]" type="button"><Upload className="w-4 h-4"/> {label}</Button>
    )
}