import { AnimatePresence, motion } from "framer-motion";
import FileType from "@/app/utils/types/image"
import { IoIosClose } from "react-icons/io";
import { FaTrash } from "react-icons/fa6";
import { useEffect, useRef } from "react";

interface ImageViewerProps {
    image: FileType | null,
    setImage: (image: FileType |  null) => void;
    deleteImage: (id: string) => Promise<void>;
}

export default function ImageViewer({ image, setImage, deleteImage } : ImageViewerProps) {
    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                imageRef.current &&
                toolbarRef.current &&
                !imageRef.current.contains(event.target as Node) &&
                !toolbarRef.current.contains(event.target as Node)
            ) {
                setImage(null);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setImage]);

    const handleDelete = async () => {
        if (!image) return;
        await deleteImage(image.id);
        setImage(null);
    }

    return (
        <AnimatePresence mode="wait">
            {
                image &&
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-screen h-screen fixed top-0 left-0 bg-black/75 z-1000"
                >
                    <div className="w-full h-screen flex flex-col">
                        <div className="h-16 text-xxs flex items-center justify-between px-4 flex-1 bg-black/20 z-1001" ref={toolbarRef}>
                            <div>
                                <span className="text-white text-sm font-medium">{image.file.name}</span>
                            </div>
                            <div className="flex items-center gap-x-2">
                                <button onClick={handleDelete} className="group size-9 rounded-full flex-center hover:bg-gray-200/25 transition-all">
                                    <FaTrash className="size-3.5 text-white transition-all"/>
                                </button>
                                <button onClick={() => setImage(null)} className="group size-9 rounded-full flex-center hover:bg-gray-200/25 transition-all">
                                    <IoIosClose className="size-7 text-white transition-all"/>
                                </button>
                            </div>
                        </div>
                        <div className="flex-center h-[calc(100%-4rem)] w-full p-4">
                            <img src={image.objectUrl} className="object-contain max-w-full max-h-full" ref={imageRef}/>
                        </div>
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
}