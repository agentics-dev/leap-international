import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, Crop, GripVertical } from 'lucide-react';

function SortableImageItem({ id, image, onRemove, onCrop }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex items-center p-2 gap-3"
    >
      <button
        type="button"
        className="cursor-grab p-1 text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5" />
      </button>
      
      <div className="w-24 h-16 rounded overflow-hidden bg-gray-100 flex-shrink-0 relative">
        <img
          src={image.url}
          alt=""
          className="w-full h-full object-cover"
        />
        {image.cropData && (
          <div className="absolute inset-0 border-2 border-blue-500 rounded"></div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{image.name || 'Image'}</p>
        <p className="text-xs text-gray-500">
          {image.cropData ? 'Cropped (16:9)' : 'Original'}
        </p>
      </div>

      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={() => onCrop(image)}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          title="Crop"
        >
          <Crop className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(image.id)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Remove"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function DraggableImageList({ images, onReorder, onRemove, onCrop }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      onReorder(arrayMove(images, oldIndex, newIndex));
    }
  };

  if (!images || images.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={images.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {images.map((img) => (
            <SortableImageItem
              key={img.id}
              id={img.id}
              image={img}
              onRemove={onRemove}
              onCrop={onCrop}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
