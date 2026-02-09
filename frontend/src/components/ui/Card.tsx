import { ReactNode } from 'react';
import clsx from 'clsx';
import './Card.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export default function Card({
  children,
  className,
  title,
  description,
  actions,
}: CardProps) {
  return (
    <div className={clsx('card', className)}>
      {(title || description || actions) && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {description && <p className="card-description">{description}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-content">{children}</div>
    </div>
  );
}
