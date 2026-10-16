type Variante = "success" | "warning" | "error" | "info";

interface ChipProps {
  variante: Variante;
  label: string;
}

export const Chip = ({ variante, label }: ChipProps) => {
  const getVariantClasses = (v: Variante) => {
    switch (v) {
      case "success":
        return "bg-primary/15 text-primary";
      case "warning":
        return "bg-warning/20 text-warning-foreground";
      case "error":
        return "bg-danger/15 text-danger";
      case "info":
        return "bg-violet/15 text-violet";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <span
      className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${getVariantClasses(
        variante,
      )}`}
    >
      {label}
    </span>
  );
};