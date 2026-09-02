import {
  Bot,
  Building2,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Bot,
  Building2,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Stethoscope,
};

export function IndustryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Bot;
  return <Icon className={className} aria-hidden="true" />;
}
