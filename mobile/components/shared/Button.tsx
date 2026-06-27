import { ReactNode } from 'react';
import { Pressable } from 'react-native';

interface ButtonProps {
  children?: ReactNode;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
}

export default function Button({ children, onPress, className, disabled = false }: ButtonProps) {
  const base = 'px-4 py-5 rounded-full border flex-row items-center justify-center gap-x-2';

  return (
    <Pressable onPress={onPress} className={`${base} ${className ? className : ''}`} disabled={disabled}>
      {children}
    </Pressable>
  );
}
