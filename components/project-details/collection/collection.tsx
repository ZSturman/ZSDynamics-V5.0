import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Project, CollectionItem } from "@/types";
import CollectionItemCard from "./collection-item";
import { formatTextWithNewlines } from "@/lib/utils";

interface CollectionProps {
  project: Project;
  inModal?: boolean;
}

export function Collection({ project, inModal }: CollectionProps) {
  // Handle collection structure: { [collectionName: string]: CollectionItem[] | { items: CollectionItem[] } }
  if (!project.collection || Object.keys(project.collection).length === 0) {
    return null;
  }

  const collections = Object.entries(project.collection);
  const folderName = project.folderName || project.id;
  
  // If only one collection, render it directly without tabs
  if (collections.length === 1) {
    const [collectionName, collectionData] = collections[0];
    
    // Handle both direct array and nested items structure
    const items: CollectionItem[] = Array.isArray(collectionData) ? collectionData : (collectionData as { items: CollectionItem[] }).items || [];
    const collectionInfo = Array.isArray(collectionData) ? {} : (collectionData as { label?: string; summary?: string; description?: string; items?: CollectionItem[] });
    const label = collectionInfo.label || collectionName;
    const summary = collectionInfo.summary;
    const description = collectionInfo.description;
    
    if (!items || items.length === 0) {
      return null;
    }

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">{label}</h3>
          {summary && (
            <p className="text-sm text-muted-foreground" style={{ whiteSpace: 'pre-wrap' }}>
              {formatTextWithNewlines(summary)}
            </p>
          )}
          {description && (
            <p className="text-sm text-muted-foreground" style={{ whiteSpace: 'pre-wrap' }}>
              {formatTextWithNewlines(description)}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, idx) => (
            <CollectionItemCard 
              key={item.id || idx} 
              item={item} 
              project={project} 
              inModal={inModal} 
              folderName={folderName} 
              collectionName={collectionName}
              allItems={items}
              currentIndex={idx}
            />
          ))}
        </div>
      </div>
    );
  }

  // Multiple collections -> render tabs per collection name
  return (
    <Tabs defaultValue={collections[0][0]} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {collections.map(([collectionName, collectionData]) => {
          const collectionInfo = Array.isArray(collectionData) ? {} : (collectionData as { label?: string; summary?: string; description?: string; items?: CollectionItem[] });
          const label = collectionInfo.label || collectionName;
          return (
            <TabsTrigger key={collectionName} value={collectionName}>
              {label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {collections.map(([collectionName, collectionData]) => {
        // Handle both direct array and nested items structure
        const items: CollectionItem[] = Array.isArray(collectionData) ? collectionData : (collectionData as { items: CollectionItem[] }).items || [];
        const collectionInfo = Array.isArray(collectionData) ? {} : (collectionData as { label?: string; summary?: string; description?: string; items?: CollectionItem[] });
        const summary = collectionInfo.summary;
        const description = collectionInfo.description;
        
        return (
          <TabsContent key={collectionName} value={collectionName} className="space-y-6">
            {(summary || description) && (
              <div className="space-y-2">
                {summary && (
                  <p className="text-sm text-muted-foreground" style={{ whiteSpace: 'pre-wrap' }}>
                    {formatTextWithNewlines(summary)}
                  </p>
                )}
                {description && (
                  <p className="text-sm text-muted-foreground" style={{ whiteSpace: 'pre-wrap' }}>
                    {formatTextWithNewlines(description)}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item, idx) => (
                <CollectionItemCard 
                  key={item.id || idx} 
                  item={item} 
                  project={project} 
                  inModal={inModal} 
                  folderName={folderName} 
                  collectionName={collectionName}
                  allItems={items}
                  currentIndex={idx}
                />
              ))}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
