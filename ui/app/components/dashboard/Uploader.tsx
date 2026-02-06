import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import { FileRejection, useDropzone } from "react-dropzone";

import useFormContext from "@/app/context/Form";
import { CreatePitchFormType } from '@/app/utils/types/dashboard';
import { BASE_URL, mutate } from '@/app/utils/api/base';
import ImageViewer from '@/app/components/dashboard/ImageViewer';
import FileType from '@/app/utils/types/image';

import { FaUpload } from "react-icons/fa6";
import { LuLoaderCircle } from 'react-icons/lu';

export default function Uploader() {
    const { data, setData, setErrors } = useFormContext<CreatePitchFormType>();

    const deleteFile = async (id: string) => {
        try {
            const file = data.images.find((f: FileType) => f.id === id);
            if (!file) return;

            if (file.objectUrl) {
                URL.revokeObjectURL(file.objectUrl);
            };

            setData(prev => ({ ...prev, images: 
                prev.images.map((f: FileType) =>
                    f.id === id ? {
                        ...f,
                        isDeleting: true
                    } :
                    f
                )
            }));

            const res = await fetch(`${BASE_URL}/upload/presign`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    key: file.key
                })
            });

            if (!res.ok) {
                setErrors({ "images": "Failed to delete image." });

                setData(prev => ({ ...prev, images: 
                    prev.images.map((f: FileType) =>
                        f.id === id ? {
                            ...f,
                            isDeleting: false,
                            error: true
                        } :
                        f
                    )
                }));
                
                return;
            };
            
            setData(prev => ({ ...prev, images: prev.images.filter((f: FileType) => f.id != id)}));
            console.log("File deleted successfully.");
        } catch {
            setData(prev => ({ ...prev, images: 
                prev.images.map((f: FileType) =>
                    f.id === id ? {
                        ...f,
                        isDeleting: false,
                        error: true
                    } :
                    f
                )
            }));

            setErrors({ "images": "Failed to delete image." });
        }
    }

    const uploadFile = async (file: File) => {
        setData(prev => ({ ...prev, images: 
            prev.images.map((f: FileType) =>
                 f.file === file ? {
                    ...f,
                    uploading: true
                } :
                f
            )
        }));

        try {
            const res = await mutate<{ url: string, key: string }>('/upload/presign', {
                fileName: file.name,
                contentType: file.type,
                size: file.size
            });
            
            const { url, key } = res;

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percentage = (e.loaded / e.total) * 100;

                        setData(prev => ({ ...prev, images: 
                            prev.images.map((f: FileType) =>
                                f.file === file ? {
                                    ...f,
                                    progress: Math.round(percentage),
                                    key
                                } :
                                f
                            )
                        }));
                    };
                };

                xhr.onload = () => {
                    if (xhr.status === 200 || xhr.status === 204) {
                        setData(prev => ({ ...prev, images: 
                            prev.images.map((f: FileType) =>
                                f.file === file ? {
                                    ...f,
                                    progress: 100,
                                    error: false,
                                    uploading: false
                                } :
                                f
                            )
                        }));

                        console.log("File uploaded successfully.");
                        resolve();
                    } else {
                        reject(console.log("Error has occurred while uploading file."));
                    }
                };

                xhr.onerror = () => reject(console.log("Error has occurred while uploading file."));
                xhr.open("PUT", url);
                xhr.setRequestHeader("Content-Type", file.type);
                xhr.send(file);
            });
        } catch {
            setData(prev => ({ ...prev, images: 
                prev.images.map((f: FileType) =>
                    f.file === file ? {
                        ...f,
                        uploading: false,
                        progress: 0,
                        error: true
                    } :
                    f
                )
            }));
        }
    };

    const onDrop = (files: File[]) => {
        if (files.length > 0) {
            setData(prev => ({ ...prev, images: [
                ...prev.images,
                ...files.map(file => ({
                    id: uuidv4(),
                    file,
                    uploading: false,
                    progress: 0,
                    isDeleting: false,
                    error: false,
                    objectUrl: URL.createObjectURL(file)
                }))
            ]}))

            files.forEach(uploadFile);
        };
    };

    const onDropRejected = (rejections: FileRejection[]) => {
        if (rejections.length > 0) {
            const isTooMany = rejections.find(r => r.errors[0].code == "too-many-files");
            const isInvalidType = rejections.find(r => r.errors[0].code == "file-invalid-type");
            const isTooLarge = rejections.find(r => r.errors[0].code == "file-too-large");

            if (isTooMany) {
                setErrors({ "images": "You may only upload up to 10 images." });
                return;
            };

            if (isInvalidType) {
                setErrors({ "images": "The image(s) must be one of the supported formats." });
                return;
            };

            if (isTooLarge) {
                setErrors({ "images": "Image(s) may be up to 10 MBs large." });
                return;
            };
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop,
        onDropRejected,
        maxFiles: 10,
        maxSize: 1024 * 1024 * 10,
        accept: {
            "image/*": [".png", ".jpg", ".jpeg"]
        }
    });

    const [image, setImage] = useState<FileType | null>(null);

    return (
        <>
            <ImageViewer image={image} setImage={setImage} deleteImage={deleteFile}/>
            <AnimatePresence>
                {
                    <div 
                        {...getRootProps()} 
                        className={`w-full p-6 flex-center text-center flex-col gap-y-4 border border-dashed text-gray-800 rounded-md cursor-pointer ${isDragActive ? "border-secondary" : "border-gray-400"} transition-colors`}
                    >
                        <input {...getInputProps()}/>
                        <FaUpload className="size-5"/>
                        <div>
                            <span className="text-sm font-medium">
                                {
                                    isDragActive ?
                                    "Drop the files here..." :
                                    "Choose a file or drag & drop it here."
                                }
                            </span>
                            <p className="text-xs text-gray-500">Supported files: JPEG, JPG, PNG up to 10 MBs.</p>
                        </div>
                        <button className="text-xxs rounded-full hover:bg-gray-100 transition-colors border border-gray-300 px-5 py-2">Upload file</button>
                    </div>
                }
            </AnimatePresence>
            <div className='flex flex-wrap gap-x-4 gap-y-2.5'>
                <AnimatePresence>
                    {
                        data.images.map((image: FileType) => {
                            const isPending = image.isDeleting || image.uploading;

                            return (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    key={image.id}
                                    className='flex flex-col gap-y-0.5 w-12'
                                    layout={true}
                                >
                                    <button className='size-12 flex-center rounded-sm overflow-clip group relative' onClick={() => setImage(image)} disabled={isPending}>
                                        <div className={`${isPending ? "opacity-30" : "group-hover:opacity-30 opacity-0"} bg-black absolute top-0 left-0 w-full h-full transition-all`}></div>
                                        {
                                            image.uploading &&
                                            <span className='text-xs text-white absolute top-1/2 left-1/2 -translate-1/2'>{image.progress}%</span>
                                        }
                                        {
                                            image.isDeleting &&
                                            <LuLoaderCircle className="absolute top-1/2 left-1/2 -translate-1/2 text-white animate-spin size-4"/>
                                        }
                                        <img src={image.objectUrl} alt={image.file.name} className='w-full h-full'/>
                                    </button>
                                    <span className='text-xs truncate'>{image.file.name}</span>
                                </motion.div>
                            )
                        })
                    }
                </AnimatePresence>
            </div>
        </>
    )
}