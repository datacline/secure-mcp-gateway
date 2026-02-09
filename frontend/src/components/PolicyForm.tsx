import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import type { Policy } from '../types/policy';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import './PolicyForm.css';

interface PolicyFormProps {
  initialData?: Partial<Policy>;
  onSubmit: (data: Partial<Policy>) => Promise<void>;
  submitLabel: string;
  isLoading?: boolean;
}

const conditionTypes = ['user', 'time', 'resource', 'rate', 'data', 'tool'];
const conditionOperators = ['eq', 'neq', 'in', 'not_in', 'gt', 'lt', 'gte', 'lte', 'matches', 'contains'];
const actionTypes = ['allow', 'deny', 'require_approval', 'redact', 'rate_limit', 'log_only', 'modify'];

export default function PolicyForm({
  initialData,
  onSubmit,
  submitLabel,
  isLoading,
}: PolicyFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Partial<Policy>>({
    defaultValues: initialData || {
      name: '',
      description: '',
      enabled: true,
      enforcement: 'blocking',
      rules: [
        {
          id: 'rule-1',
          description: '',
          priority: 100,
          conditions: [{ type: 'user', operator: 'eq', field: '', value: '' }],
          actions: [{ type: 'allow', params: {} }],
        },
      ],
    },
  });

  const { fields: ruleFields, append: appendRule, remove: removeRule } = useFieldArray({
    control,
    name: 'rules',
  });

  const handleFormSubmit = async (data: Partial<Policy>) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="policy-form">
      {/* Basic Information */}
      <Card title="Basic Information" description="General policy configuration">
        <div className="form-grid">
          <Input
            label="Policy Name"
            {...register('name', { required: 'Policy name is required' })}
            error={errors.name?.message}
            placeholder="e.g., Production Access Control"
            required
          />

          <div className="input-group">
            <label htmlFor="enabled" className="input-label">
              Status
            </label>
            <select {...register('enabled')} className="input">
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>

          <div className="input-group form-col-span-2">
            <label htmlFor="description" className="input-label">
              Description
            </label>
            <textarea
              {...register('description')}
              className="input"
              placeholder="Describe the purpose of this policy..."
              rows={3}
            />
          </div>

          <div className="input-group">
            <label htmlFor="enforcement" className="input-label">
              Enforcement Mode
            </label>
            <select {...register('enforcement')} className="input">
              <option value="blocking">Blocking</option>
              <option value="audit_only">Audit Only</option>
            </select>
            <p className="input-helper-text">
              Blocking: Deny actions that violate the policy. Audit Only: Log violations but allow actions.
            </p>
          </div>
        </div>
      </Card>

      {/* Rules */}
      <Card
        title="Policy Rules"
        description="Define conditions and actions for this policy"
        actions={
          <Button
            type="button"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() =>
              appendRule({
                id: `rule-${ruleFields.length + 1}`,
                description: '',
                priority: 100,
                conditions: [{ type: 'user', operator: 'eq', field: '', value: '' }],
                actions: [{ type: 'allow', params: {} }],
              })
            }
          >
            Add Rule
          </Button>
        }
      >
        {ruleFields.length === 0 && (
          <div className="empty-state-small">
            <p>No rules defined. Add at least one rule.</p>
          </div>
        )}

        {ruleFields.map((rule, ruleIndex) => (
          <RuleEditor
            key={rule.id}
            ruleIndex={ruleIndex}
            register={register}
            control={control}
            onRemove={() => removeRule(ruleIndex)}
            canRemove={ruleFields.length > 1}
          />
        ))}
      </Card>

      {/* Submit */}
      <div className="form-actions">
        <Button type="submit" loading={isLoading} size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// RuleEditor component
function RuleEditor({ ruleIndex, register, control, onRemove, canRemove }: any) {
  const { fields: conditionFields, append: appendCondition, remove: removeCondition } = useFieldArray({
    control,
    name: `rules.${ruleIndex}.conditions`,
  });

  const { fields: actionFields, append: appendAction, remove: removeAction } = useFieldArray({
    control,
    name: `rules.${ruleIndex}.actions`,
  });

  return (
    <div className="rule-editor">
      <div className="rule-header">
        <Input
          label="Rule ID"
          {...register(`rules.${ruleIndex}.id`, { required: true })}
          placeholder="e.g., allow-admins"
        />
        <Input
          label="Priority"
          type="number"
          {...register(`rules.${ruleIndex}.priority`, { valueAsNumber: true })}
          placeholder="100"
        />
        {canRemove && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            icon={<Trash2 size={16} />}
            onClick={onRemove}
          >
            Remove Rule
          </Button>
        )}
      </div>

      <Input
        label="Rule Description (optional)"
        {...register(`rules.${ruleIndex}.description`)}
        placeholder="Describe what this rule does..."
      />

      {/* Conditions */}
      <div className="rule-section">
        <div className="rule-section-header">
          <h4>Conditions</h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={<Plus size={14} />}
            onClick={() =>
              appendCondition({ type: 'user', operator: 'eq', field: '', value: '' })
            }
          >
            Add Condition
          </Button>
        </div>

        {conditionFields.map((condition, condIndex) => (
          <div key={condition.id} className="condition-row">
            <select
              {...register(`rules.${ruleIndex}.conditions.${condIndex}.type`)}
              className="input input-sm"
            >
              {conditionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              {...register(`rules.${ruleIndex}.conditions.${condIndex}.operator`)}
              className="input input-sm"
            >
              {conditionOperators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>

            <input
              {...register(`rules.${ruleIndex}.conditions.${condIndex}.field`)}
              className="input input-sm"
              placeholder="field"
            />

            <input
              {...register(`rules.${ruleIndex}.conditions.${condIndex}.value`)}
              className="input input-sm"
              placeholder="value"
            />

            {conditionFields.length > 1 && (
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={() => removeCondition(condIndex)}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="rule-section">
        <div className="rule-section-header">
          <h4>Actions</h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={<Plus size={14} />}
            onClick={() => appendAction({ type: 'allow', params: {} })}
          >
            Add Action
          </Button>
        </div>

        {actionFields.map((action, actionIndex) => (
          <div key={action.id} className="action-row">
            <select
              {...register(`rules.${ruleIndex}.actions.${actionIndex}.type`)}
              className="input input-sm"
            >
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              {...register(`rules.${ruleIndex}.actions.${actionIndex}.params`)}
              className="input input-sm"
              placeholder='{"key": "value"} (optional)'
            />

            {actionFields.length > 1 && (
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={() => removeAction(actionIndex)}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
