import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';
import { cloneElement, isValidElement } from 'react';

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  children,
  ...props
}) {
  if (asChild) {
    // When asChild is true, merge button styles with the child element
    if (isValidElement(children)) {
      return cloneElement(children, {
        ...props,
        className: cn(
          buttonVariants({ variant, size }),
          className,
          children.props.className,
        ),
      });
    }
    // Fallback if children is not a valid element
    console.warn(
      'Button: asChild is true but children is not a valid React element',
    );
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        'transition-all duration-160 ease-out active:scale-[0.97]',
        buttonVariants({ variant, size, className }),
      )}
      {...props}
    >
      {children}
    </ButtonPrimitive>
  );
}

export { Button };
