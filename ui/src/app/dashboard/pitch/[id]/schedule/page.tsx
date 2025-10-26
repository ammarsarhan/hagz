export default async function Schedule({
    params,
} : {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;

    return (
        <div>
            
        </div>
    );
};
