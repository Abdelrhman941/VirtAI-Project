import React from 'react';

export function ListItem({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li className="[&>p]:my-0 my-0.5" {...props}>
      {children}
    </li>
  );
}
