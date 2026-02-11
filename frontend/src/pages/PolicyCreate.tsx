import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import UnifiedPolicyForm from '../components/UnifiedPolicyForm';
import { unifiedPolicyApi } from '../services/api';
import type { UnifiedPolicyCreateRequest } from '../types/policy';
import Button from '../components/ui/Button';
import './PolicyCreate.css';

export default function PolicyCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: unifiedPolicyApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unified-policies'] });
      navigate(`/policies/${data.policy_id}`);
    },
    onError: (error: Error) => {
      alert(`Failed to create policy: ${error.message}`);
    },
  });

  const handleSubmit = async (data: UnifiedPolicyCreateRequest) => {
    await createMutation.mutateAsync(data);
  };

  return (
    <div className="policy-create-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/policies')}
          >
            Back
          </Button>
        </div>
        <div>
          <h1 className="page-title">Create Policy</h1>
          <p className="page-description">
            Define a new access control or security policy
          </p>
        </div>
      </div>

      <UnifiedPolicyForm
        onSubmit={handleSubmit}
        submitLabel="Create Policy"
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
