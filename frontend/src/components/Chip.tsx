
type Variante = "success" | "warning" | "error" | "info";

interface ChipProps {
  variante: Variante;
  label: string;
}

export const Chip = ({ variante, label }: ChipProps) => {
  // Map variante to Tailwind colors
  const getVariantClasses = (v: Variante) => {
    switch (v) {
      case "success":
        return "bg-green-100 text-green-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "info":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getVariantClasses(
      variante
    )}`}>
      {label}
    </span>
  );
};