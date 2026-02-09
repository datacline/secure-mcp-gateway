import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ArrowLeft } from 'lucide-react';
import UnifiedPolicyForm from '../components/UnifiedPolicyForm';
import { unifiedPolicyApi } from '../services/api';
import type { UnifiedPolicyCreateRequest } from '../types/policy';
import Button from '../components/ui/Button';
import './PolicyEdit.css';

export default function PolicyEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: policy, isLoading } = useQuery(
    ['unified-policy', id],
    () => unifiedPolicyApi.get(id!),
    { enabled: !!id }
  );

  const updateMutation = useMutation(
    (data: UnifiedPolicyCreateRequest) => unifiedPolicyApi.update(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('unified-policies');
        queryClient.invalidateQueries(['unified-policy', id]);
        navigate(`/policies/${id}`);
      },
      onError: (error: Error) => {
        alert(`Failed to update policy: ${error.message}`);
      },
    }
  );

  const handleSubmit = async (data: UnifiedPolicyCreateRequest) => {
    await updateMutation.mutateAsync(data);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <p>Loading policy...</p>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="error-container">
        <p>Policy not found</p>
        <Button onClick={() => navigate('/policies')}>Back to Policies</Button>
      </div>
    );
  }

  // Convert policy to form initial data
  const initialData: Partial<UnifiedPolicyCreateRequest> = {
    name: policy.name,
    policy_code: policy.policy_code,
    description: policy.description,
    status: policy.status,
    priority: policy.priority,
    policy_rules: policy.policy_rules,
  };

  return (
    <div className="policy-edit-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate(`/policies/${id}`)}
          >
            Back
          </Button>
        </div>
        <div>
          <h1 className="page-title">Edit Policy</h1>
          <p className="page-description">
            Update policy: <strong>{policy.name}</strong>
          </p>
        </div>
      </div>

      <UnifiedPolicyForm
        initialData={initialData}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        isLoading={updateMutation.isLoading}
      />
    </div>
  );
}
