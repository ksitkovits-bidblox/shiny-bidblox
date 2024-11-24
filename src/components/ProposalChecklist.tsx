import React, { useState, useEffect } from 'react';
import { Loader2, CheckSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';
import { companyApi, makeRequest } from '@/utils/api';
import type { ChecklistItem, ProposalChecklist } from '@/utils/api';



interface ProposalChecklistProps {
  proposalId: string;
  projectId: string;
  id?: string;
  onRegenerate?: () => void; // Add this prop
}

const ProposalChecklist: React.FC<ProposalChecklistProps> = ({ 
  proposalId, 
  projectId,
  onRegenerate 
}) => {
  const [checklist, setChecklist] = useState<ProposalChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, userProfile, isAuthenticated } = useAuth();

  // This effect will run on mount and when proposalId changes
  useEffect(() => {
    fetchExistingChecklist();
  }, [proposalId]);


  const getCompletionPercentage = () => {
    if (!checklist?.items.length) return 0;
    // Only count non-heading items for completion percentage
    const checkableItems = checklist.items.filter(item => !item.isHeading);
    if (checkableItems.length === 0) return 0;
    const completed = checkableItems.filter(item => item.completed).length;
    return Math.round((completed / checkableItems.length) * 100);
  };

  
  const fetchExistingChecklist = async () => {
    if (!userProfile?.companyName || !user) return;
  
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      const companyName = userProfile.companyName.toLowerCase();
      
      console.log('Fetching checklist:', { 
        proposalId,
        company: companyName,
        path: `/companies/${companyName}/proposals/${proposalId}/checklist`
      });
  
      const data = await makeRequest(
        `/companies/${companyName}/proposals/${proposalId}/checklist`,
        { user, userProfile, isAuthenticated }
      );
  
      setChecklist(data);
    } catch (err) {
      console.error('Error fetching checklist:', err);
      if (err instanceof Error && err.message.includes('404')) {
        setChecklist(null);
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch checklist');
    } finally {
      setLoading(false);
    }
  };
  


  const handleRegenerate = async () => {
    if (!userProfile?.companyName || !user) return;
    
    setGenerating(true);
    setError(null);
  
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      const companyName = userProfile.companyName.toLowerCase();
      
      console.log('Generating checklist:', {
        proposalId,
        projectId,
        company: companyName,
        path: `/companies/${companyName}/proposals/${proposalId}/generate-checklist`
      });
  
      const data = await makeRequest(
        `/companies/${companyName}/proposals/${proposalId}/generate-checklist`,
        { user, userProfile, isAuthenticated },
        {
          method: 'POST',
          body: JSON.stringify({ projectId })
        }
      );
  
      setChecklist(data);
      
      if (onRegenerate) {
        onRegenerate();
      }
    } catch (err) {
      console.error('Error generating checklist:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate checklist');
    } finally {
      setGenerating(false);
    }
  };
  


  
  const toggleChecklistItem = async (itemId: string) => {
    if (!checklist || !userProfile?.companyName || !user) return;
  
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
  
      const companyName = userProfile.companyName.toLowerCase();
      const item = checklist.items.find(i => i.id === itemId);
      if (!item || item.isHeading) return;
  
      // Optimistically update UI
      setChecklist(prev => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map(i => 
            i.id === itemId ? { ...i, completed: !i.completed } : i
          )
        };
      });
  
      await makeRequest(
        `/companies/${companyName}/proposals/${proposalId}/checklist/items/${itemId}`,
        { user, userProfile, isAuthenticated },
        {
          method: 'PATCH',
          body: JSON.stringify({ completed: !item.completed })
        }
      );
    } catch (err) {
      console.error('Error updating checklist item:', err);
      // Revert optimistic update
      setChecklist(prev => {
        if (!prev) return null;
        const item = prev.items.find(i => i.id === itemId);
        if (!item) return prev;
        return {
          ...prev,
          items: prev.items.map(i => 
            i.id === itemId ? { ...i, completed: item.completed } : i
          )
        };
      });
      setError('Failed to update checklist item');
    }
  };

  useEffect(() => {
    if (proposalId) {
      fetchExistingChecklist();
    }
  }, [proposalId, userProfile?.companyName, user?.uid]);

 



  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
       <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !checklist ? (
        <div className="text-center p-8">
          <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No Checklist Generated</h3>
          <p className="text-sm text-gray-500 mb-6">
            Generate a checklist based on the RFP requirements.
          </p>
          <Button
            onClick={handleRegenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate Checklist
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Completion Progress</span>
              <span>{getCompletionPercentage()}%</span>
            </div>
            <Progress value={getCompletionPercentage()} />
          </div>

          {/* Checklist Items */}
          <div className="divide-y divide-gray-100">
            {checklist.items.map((item, index) => {
              const isFirstItemAfterHeading = index > 0 && 
                checklist.items[index - 1].isHeading;

              return (
                <div 
                  key={item.id}
                  className={cn(
                    item.isHeading 
                      ? "pt-6 first:pt-0" // Spacing for headers
                      : "py-2 pl-4", // Indent normal items
                    isFirstItemAfterHeading ? "pt-3" : "" // Adjust spacing after headers
                  )}
                >
                  {item.isHeading ? (
                    // Section Header
                    <h3 className="font-semibold text-base text-gray-900 pb-2 border-b">
                      {item.text}
                    </h3>
                  ) : (
                    // Checklist Item
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={item.id}
                        checked={item.completed}
                        onCheckedChange={() => toggleChecklistItem(item.id)}
                        className="mt-1"
                      />
                      <label
                        htmlFor={item.id}
                        className={cn(
                          "text-sm leading-relaxed cursor-pointer flex-1",
                          item.completed ? "text-gray-500 line-through" : "text-gray-700"
                        )}
                      >
                        {item.text}
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-500 pt-4 border-t space-y-1">
            <div>Generated: {new Date(checklist.generatedAt).toLocaleString()}</div>
            <div>Last Updated: {new Date(checklist.lastUpdated).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalChecklist;