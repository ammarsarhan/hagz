import { useRef } from "react";
import { ScrollView, type ScrollViewInstance, type ScrollViewProps } from "react-native";
import { isRTL } from "@/lib/language";

// A row that scrolls sideways (the filter chips), starting at its start: the left in English, the
// right in Arabic. A right-to-left horizontal ScrollView lays its content out from the right but
// still opens at offset 0, its left end, so the row opened on its last chips. Here the scroll view
// itself is always left to right (offsets mean the same on iOS and Android) and only its content
// runs right to left; in Arabic it opens scrolled to the end, and keeps its distance from the right
// edge when chips come and go, as an English row keeps its distance from the left.
export function RowScroll({
  contentContainerStyle,
  onContentSizeChange,
  ...props
}: ScrollViewProps) {
  const row = useRef<ScrollViewInstance>(null);
  const x = useRef(0);
  const contentWidth = useRef<number | null>(null);
  if (!isRTL) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        onContentSizeChange={onContentSizeChange}
        {...props}
      />
    );
  }
  return (
    <ScrollView
      ref={row}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      {...props}
      style={[props.style, { direction: "ltr" }]}
      contentContainerStyle={[contentContainerStyle, { direction: "rtl" }]}
      onScroll={(event) => {
        x.current = event.nativeEvent.contentOffset.x;
        props.onScroll?.(event);
      }}
      onContentSizeChange={(width, height) => {
        const before = contentWidth.current;
        contentWidth.current = width;
        if (before === null) row.current?.scrollToEnd({ animated: false });
        else if (width !== before) {
          x.current = Math.max(0, x.current + width - before);
          row.current?.scrollTo({ x: x.current, animated: false });
        }
        onContentSizeChange?.(width, height);
      }}
    />
  );
}
