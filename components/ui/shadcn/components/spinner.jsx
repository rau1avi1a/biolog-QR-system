import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/components/utils/utils";

const spinnerVariants = cva("relative block opacity-[0.65]", {
  variants: {
    size: {
      sm: "w-4 h-4",
      md: "w-6 h-6",
      lg: "w-8 h-8",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

const Spinner = React.forwardRef(({ className, size, loading = true, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "span";

  const [bgColorClass, filteredClassName] = React.useMemo(() => {
    const bgClass = className?.match(/(?:dark:bg-|bg-)[a-zA-Z0-9-]+/g) || [];
    const filteredClasses = className?.replace(/(?:dark:bg-|bg-)[a-zA-Z0-9-]+/g, '').trim();
    return [bgClass, filteredClasses];
  }, [className]);

  if (!loading) return null;

  return (
    (<Comp
      className={cn(spinnerVariants({ size, className: filteredClassName }))}
      ref={ref}
      {...props}>
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 left-1/2 w-[12.5%] h-full animate-spinner-leaf-fade"
          style={{
            transform: `rotate(${i * 45}deg)`,
            animationDelay: `${-(7 - i) * 100}ms`,
          }}>
          <span className={cn("block w-full h-[30%] rounded-full", bgColorClass)}></span>
        </span>
      ))}
    </Comp>)
  );
});

Spinner.displayName = "Spinner";

export { Spinner, spinnerVariants };

// // app/components/ui/spinner.jsx

// "use client";

// import React from "react";

// export function Spinner() {
//   return (
//     <svg
//       className="animate-spin h-5 w-5 text-white"
//       xmlns="http://www.w3.org/2000/svg"
//       fill="none"
//       viewBox="0 0 24 24"
//     >
//       <circle
//         className="opacity-25"
//         cx="12"
//         cy="12"
//         r="10"
//         stroke="currentColor"
//         strokeWidth="4"
//       ></circle>
//       <path
//         className="opacity-75"
//         fill="currentColor"
//         d="M4 12a8 8 0 018-8v8H4z"
//       ></path>
//     </svg>
//   );
// }
