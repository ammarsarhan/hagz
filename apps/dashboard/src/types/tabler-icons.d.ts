// Per-icon entry points (@tabler/icons-react-native/IconChevronLeft): the package ships their types
// one folder deeper than its exports map says, so TypeScript can't find them on its own.
declare module "@tabler/icons-react-native/*" {
  import type { Icon } from "@tabler/icons-react-native";
  const icon: Icon;
  export default icon;
}
