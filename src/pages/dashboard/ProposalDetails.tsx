import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Calendar, Building2, Tag, Clock, RefreshCw, Sparkles, FileText, CheckSquare, ListCheck, Copy, CheckCheck, } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProposalChecklist from '@/components/ProposalChecklist';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { companyApi, makeRequest, getCompanyFromEmail, ExportOptions } from '@/utils/api'; 
import { useAuth } from '@/contexts/AuthContext';
import { FileDown } from 'lucide-react'; // Add this to imports
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Add these imports




interface ProposalData {
  id: string;
  projectId: string;
  projectName: string;
  organization: string;
  category: 'construction' | 'renovation' | 'infrastructure' | 'consulting';
  dueDate: string;
  status: 'draft' | 'in-progress' | 'review' | 'submitted' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

interface ProposalDraft {
  content: string;
  generatedAt: string;
  lastUpdated: string;
}



const EmptyDraftState = ({ onGenerate, isGenerating }: { 
  onGenerate: () => void;
  isGenerating: boolean;
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="bg-gray-50 rounded-lg p-8 w-full max-w-md text-center">
      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Draft Generated</h3>
      <p className="text-gray-500 mb-6">
        Generate a proposal draft based on the RFP requirements and project details.
      </p>
      <Button
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating Draft...
          </>
        ) : (
          <>
            <FileText className="mr-2 h-4 w-4" />
            Generate Draft
          </>
        )}
      </Button>
    </div>
  </div>
);

// Get your helper functions for colors
const getStatusColor = (status: string) => {
  const colors = {
    draft: 'bg-gray-100 text-gray-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    review: 'bg-blue-100 text-blue-800',
    submitted: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getCategoryColor = (category: string) => {
  const colors = {
    construction: 'bg-blue-100 text-blue-800',
    renovation: 'bg-purple-100 text-purple-800',
    infrastructure: 'bg-green-100 text-green-800',
    consulting: 'bg-orange-100 text-orange-800',
  };
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};




const ProposalDetails: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, userProfile, isAuthenticated } = useAuth();
    // Main proposal states
    const [proposal, setProposal] = useState<ProposalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Draft-specific states
    const [draft, setDraft] = useState<ProposalDraft | null>(null);
    const [draftLoading, setDraftLoading] = useState(false);
    const [draftError, setDraftError] = useState<string | null>(null);
    const [generatingDraft, setGeneratingDraft] = useState(false);
    
    // Other states
    const [activeTab, setActiveTab] = useState('overview');
    const [checklistKey, setChecklistKey] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

const api = useMemo(() => {
  if (!userProfile?.companyName || !user || !isAuthenticated) {
    return null;
  }
  return companyApi({ user, userProfile, isAuthenticated });
}, [user, userProfile?.companyName, isAuthenticated]);


/*const fetchProposal = useCallback(async (signal?: AbortSignal) => {
  if (!user?.email || !id) return;
    
  setLoading(true);
  
  try {
    const data = await api?.proposals.get(id);
    if (!data) return;
    
    setProposal(data);
    
    const draftData = await api?.proposals.getDraft(id);
    setDraft(draftData || null);
        
  } catch (error) {
    console.error('Error fetching proposal:', error);
    setError(error instanceof Error ? error.message : 'Failed to load proposal');
  } finally {
    if (!signal?.aborted) {
      setLoading(false);
    }
  }
}, [id, api]);*/

const fetchProposal = useCallback(async (signal?: AbortSignal) => {
  if (!id || !api) {
    setError('Missing required data');
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);
  setDraftLoading(true);
  setDraftError(null);
  
  try {
    // Fetch proposal data
    const proposalData = await api.proposals.get(id);
    setProposal(proposalData);

    // Try to get existing draft
    try {
      const draftData = await api.proposals.getDraft(id);
      setDraft(draftData);
    } catch (draftError) {
      console.log('No existing draft, generating new one:', draftError);
      // If no draft exists, generate one automatically
      if (proposalData) {
        const newDraft = await api.proposals.generateDraft(id, proposalData.projectId, false);
        setDraft(newDraft);
      }
    }

  } catch (error) {
    console.error('Error fetching proposal:', error);
    setError(error instanceof Error ? error.message : 'Failed to load proposal');
  } finally {
    if (!signal?.aborted) {
      setLoading(false);
      setDraftLoading(false);
    }
  }
}, [id, api]);


const stripHtml = (html: string): string => {
  // First replace common markdown-style headers with clean versions
  let text = html
    .replace(/### (.*?)\n/g, '$1\n')  // h3
    .replace(/## (.*?)\n/g, '$1\n')   // h2
    .replace(/# (.*?)\n/g, '$1\n');   // h1

  // Create a temporary element to handle HTML content
  const temp = document.createElement('div');
  temp.innerHTML = text;
  
  // Convert <li> elements to bullet points
  const listItems = temp.getElementsByTagName('li');
  for (const li of Array.from(listItems)) {
    li.textContent = `• ${li.textContent}`;
  }
  
  // Get text content and clean up spacing
  text = temp.textContent || temp.innerText || '';
  
  // Clean up extra whitespace while preserving paragraphs
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');
};

const handleCopyDraft = async () => {
  if (!draft?.content) return;
  
  try {
    setIsCopying(true);
    const cleanContent = stripHtml(draft.content);
    await navigator.clipboard.writeText(cleanContent);
    setCopySuccess(true);
    
    setTimeout(() => {
      setCopySuccess(false);
    }, 2000);
  } catch (error) {
    console.error('Failed to copy draft:', error);
  } finally {
    setIsCopying(false);
  }
};


// Single useEffect for data fetching
useEffect(() => {
  if (!api || !id) return;
  
  const abortController = new AbortController();
  fetchProposal(abortController.signal);

  return () => abortController.abort();
}, [api, id, fetchProposal]);


// Generate or regenerate draft
const generateDraft = async (regenerate = false) => {
  if (!api || !proposal || !id) return;
  
  setGeneratingDraft(true);
  setDraftLoading(true);
  setDraftError(null);

  try {
    const data = await api.proposals.generateDraft(id, proposal.projectId, regenerate);
    setDraft(data);
  } catch (err) {
    setDraftError(err instanceof Error ? err.message : 'Failed to generate draft');
  } finally {
    setDraftLoading(false);
    setGeneratingDraft(false);
  }
};

const handleExport = async (format: ExportOptions['format']) => {
  if (!proposal || !draft || !api) return;
  
  try {
    setIsExporting(true);
    
    // Clean the content before export
    const cleanContent = stripHtml(draft.content);
    
    // Prepare export data with clean content
    const exportData: ExportOptions['data'] = {
      projectName: proposal.projectName,
      organization: proposal.organization,
      category: proposal.category,
      dueDate: proposal.dueDate,
      content: cleanContent,
      generatedAt: draft.generatedAt
    };

    const blob = await api.proposals.export(proposal.id, format, exportData);
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proposal.projectName} - Proposal Draft.${format}`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Export failed:', error);
    // Consider adding a toast notification here
  } finally {
    setIsExporting(false);
  }
};


const handleChecklistRegeneration = async () => {
  if (!api || !proposal || !id) return;

  try {
    await api.proposals.generateChecklist(id, proposal.projectId);
    setChecklistKey(prev => prev + 1);
  } catch (error) {
    console.error('Error regenerating checklist:', error);
  }
};


const exportButton = (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        disabled={isExporting}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4 mr-2" />
            Export Draft
          </>
        )}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => handleExport('pdf')}>
        Export as PDF
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleExport('docx')}>
        Export as Word Document
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);



  const formatDraftContent = (content: string) => {
    const formattedContent = content
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-semibold mt-8 mb-4">$1</h1>')
      // Convert bullet points
      .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
      // Wrap lists
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="list-disc my-4 space-y-2">$1</ul>')
      // Convert paragraphs
      .split('\n\n')
      .map(para => {
        if (para.startsWith('<h') || para.startsWith('<ul')) {
          return para;
        }
        return `<p class="mb-4 text-gray-600">${para.trim()}</p>`;
      })
      .join('\n');
  
    return `
      <div class="proposal-content space-y-4">
        ${formattedContent}
      </div>
    `;
  };


  

  // Loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }


  // Error state
  if (error || !proposal) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertDescription>{error || 'Proposal not found'}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  

    // Main render

    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{proposal.projectName}</h1>
              <p className="text-gray-500">{proposal.organization}</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/proposals')}>
              Back to Proposals
            </Button>
          </div>
  
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="checklist">Requirements Checklist</TabsTrigger>
              <TabsTrigger value="draft">Proposal Draft</TabsTrigger>
            </TabsList>
  
            <TabsContent value="overview">
  <Card>
    <CardHeader className="pb-2">
      <CardTitle>Project Details</CardTitle>
      <CardDescription>View and manage project information</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Organization Information */}
          <div>
            <h3 className="font-medium mb-2">Organization Details</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="w-24 text-gray-500">Company:</span>
                <span>{proposal.organization}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-500" />
                <span className="w-24 text-gray-500">Category:</span>
                <Badge className={getCategoryColor(proposal.category)}>
                  {proposal.category.charAt(0).toUpperCase() + proposal.category.slice(1)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Project Status */}
          <div>
            <h3 className="font-medium mb-2">Project Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-500" />
                <span className="w-24 text-gray-500">Status:</span>
                <Badge className={getStatusColor(proposal.status)}>
                  {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="w-24 text-gray-500">Due Date:</span>
                <span>{new Date(proposal.dueDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Timestamps */}
          <div>
            <h3 className="font-medium mb-2">Timeline</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="w-24 text-gray-500">Created:</span>
                <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gray-500" />
                <span className="w-24 text-gray-500">Updated:</span>
                <span>{new Date(proposal.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="w-24 text-gray-500">Days Left:</span>
                <span>{Math.max(0, Math.ceil((new Date(proposal.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days</span>
              </div>
            </div>
          </div>

          {/* Project Identifiers */}
          <div>
            <h3 className="font-medium mb-2">Identifiers</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="w-24 text-gray-500">Project ID:</span>
                <span className="font-mono text-sm">{proposal.projectId}</span>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>
  
            <TabsContent value="checklist">
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0">
      <div>
        <CardTitle>Requirements Checklist</CardTitle>
        <CardDescription>Track proposal requirements</CardDescription>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleChecklistRegeneration}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Regenerate
      </Button>
    </CardHeader>
    <CardContent>
      <ProposalChecklist 
        key={checklistKey}
        proposalId={id}
        projectId={proposal.projectId}
        onRegenerate={() => setChecklistKey(prev => prev + 1)}
      />
    </CardContent>
  </Card>
</TabsContent>
  
<TabsContent value="draft">
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0">
      <div>
        <CardTitle>Proposal Draft</CardTitle>
        <CardDescription>AI-generated draft based on RFP requirements</CardDescription>
      </div>
      {draft && (
       <Button
       variant="outline"
       size="sm"
       onClick={() => generateDraft(true)}
       disabled={generatingDraft} // Use generatingDraft for the button
     >
          {generatingDraft ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Regenerate
            </>
          )}
        </Button>
      )}
    </CardHeader>
    <CardContent>
      {draftError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{draftError}</AlertDescription>
        </Alert>
      )}

      {!draft ? (
        <div className="flex flex-col items-center justify-center py-8">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center mb-4 max-w-md">
            No draft has been generated yet. Generate a proposal draft based on the RFP requirements.
          </p>
          <Button
            onClick={() => generateDraft(false)}
            disabled={generatingDraft}
          >
            {generatingDraft ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Draft...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Draft
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="generated-content">
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: formatDraftContent(draft.content) 
              }} 
            />
          </div>
          
          <div className="flex justify-between items-center border-t pt-4 mt-6">
  <div className="text-sm text-gray-500">
    Generated: {new Date(draft.generatedAt).toLocaleString()}
  </div>
  <div className="flex items-center gap-2">
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      disabled={isCopying}
      onClick={handleCopyDraft}
      title="Copy draft"
    >
      {copySuccess ? (
        <CheckCheck className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
    {/*{exportButton}*/}
  </div>
</div>
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    );
  };
  
  
export default ProposalDetails;