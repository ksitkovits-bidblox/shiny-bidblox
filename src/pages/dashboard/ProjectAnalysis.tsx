import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { doc, getDoc, updateDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { makeRequest, companyApi, getCompanyFromEmail } from '@/utils/api'; 
import { db } from '@/lib/firebase/firebase';
import type { 
  ProjectData, 
  Analysis, 
  AnalysisResults,
  AnalysisRequest,
  AnalysisQuestion,
  AnalysisResponse,
} from '@/types/project';

// Define the preset questions type
interface PresetQuestion {
  id: string;
  label: string;
  prompt: string;
}




const ProjectAnalysis = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { user, userProfile, isAuthenticated } = useAuth();

  const api = useMemo(() => {
    if (!userProfile?.companyName || !user || !isAuthenticated) return null;
    return companyApi({ user, userProfile, isAuthenticated });
  }, [user, userProfile?.companyName, isAuthenticated]);

  const presetQuestions: PresetQuestion[] = [
    { id: 'summary', label: 'Project Summary', prompt: 'Provide a concise summary of this RFP...' },
    { id: 'requirements', label: 'Submission Requirements', prompt: 'Extract submission requirements...' },
    { id: 'timeline', label: 'Timeline', prompt: 'What are the key dates and deadlines?' },
    { id: 'evaluation', label: 'Evaluation Criteria', prompt: 'Summarize the evaluation criteria' },
    { id: 'deliverables', label: 'Project Deliverables', prompt: 'What are the project deliverables by phase?' }
  ];

  const fetchCachedAnalyses = async () => {
    try {
      if (!user?.email || !id || !api) {
        console.error('Missing requirements for fetching analyses');
        return;
      }
  
      setIsLoading(true);
      const normalizedCompany = getCompanyFromEmail(user.email);
  
      console.log('Fetching cached analyses:', {
        projectId: id,
        normalizedCompany
      });
  
      const projectRef = doc(db, 'companies', normalizedCompany, 'projects', id);
      const projectSnap = await getDoc(projectRef);
  
      if (projectSnap.exists() && projectSnap.data().analyses) {
        const cachedAnalyses = projectSnap.data().analyses as AnalysisResults;
        if (Object.keys(cachedAnalyses).length > 0) {
          console.log('Found cached analyses:', {
            count: Object.keys(cachedAnalyses).length,
            normalizedCompany
          });
  
          setAnalysisResults(Object.entries(cachedAnalyses).reduce<AnalysisResults>(
            (acc, [key, analysis]) => ({
              ...acc,
              [key]: {
                ...analysis,
                normalizedCompany
              }
            }),
            {}
          ));
          return;
        }
      }
  
      console.log('No cached analyses found, generating new ones');
      await generateAllAnalyses();
  
    } catch (error) {
      console.error('Failed to load analyses:', {
        error,
        projectId: id,
        normalizedCompany: user?.email ? getCompanyFromEmail(user.email) : undefined
      });
      setError(error instanceof Error ? error.message : 'Failed to load analyses');
    } finally {
      setIsLoading(false);
    }
  };

  
  // Helper function to validate analysis data
  const isValidAnalysis = (data: any): data is Analysis => {
    return (
      typeof data.content === 'string' &&
      typeof data.generatedAt === 'string' &&
      typeof data.fileCount === 'number'
    );
  };
  
  
  // Add debugging effect
  useEffect(() => {
    console.log('🔄 Analysis results updated:', {
      count: Object.keys(analysisResults).length,
      questions: Object.keys(analysisResults),
      samples: Object.entries(analysisResults).map(([questionId, analysis]) => ({
        questionId,
        hasContent: !!analysis?.content,
        contentLength: analysis?.content?.length
      }))
    });
  }, [analysisResults]);
  
  const analyzeWithPrompt = async (prompt: string, questionId: string, forceRegenerate: boolean = false): Promise<AnalysisResponse> => {
    if (!api || !user?.email || !id) {
      throw new Error('Missing required data');
    }
  
    const normalizedCompany = getCompanyFromEmail(user.email);
    console.log('Starting analysis:', {
      projectId: id,
      questionId,
      normalizedCompany,
      forceRegenerate
    });
  
    try {
      // Check cache first if not forcing regeneration
      if (!forceRegenerate) {
        const analysisRef = doc(db, 'companies', normalizedCompany, 'projects', id, 'analyses', questionId);
        const existing = await getDoc(analysisRef);
        if (existing.exists()) {
          const data = existing.data();
          console.log('Found cached analysis:', {
            questionId,
            generatedAt: data.generatedAt,
          });
          return {
            analysis: data.content,
            generatedAt: data.generatedAt,
            wasRegenerated: false,
            fileCount: data.fileCount,
            normalizedCompany
          };
        }
      }
  
      // Make API request
      console.log('Requesting new analysis:', {
        projectId: id,
        questionId,
        normalizedCompany
      });
  
      const response = await api.projects.analyze(id, {
        prompt,
        questionId,
        forceRegenerate
      });
  
      // Save analysis result to Firestore
      const analysisData: Analysis = {
        content: response.analysis,
        generatedAt: response.generatedAt,
        fileCount: response.fileCount,
        normalizedCompany
      };
  
      // Save in both locations atomically
      await Promise.all([
        setDoc(
          doc(db, 'companies', normalizedCompany, 'projects', id, 'analyses', questionId),
          analysisData
        ),
        updateDoc(doc(db, 'companies', normalizedCompany, 'projects', id), {
          [`analyses.${questionId}`]: analysisData,
          updatedAt: new Date().toISOString()
        })
      ]);
  
      return response;
    } catch (error) {
      console.error('Analysis failed:', {
        error,
        projectId: id,
        questionId,
        normalizedCompany
      });
      throw error;
    }
  };
  
  
  const generateAllAnalyses = async () => {
    if (!user?.email || !id || !api) {
      console.error('Missing required data for analysis generation');
      return;
    }
    
    const normalizedCompany = getCompanyFromEmail(user.email);
    
    try {
      console.log('Starting analysis generation for all questions:', {
        projectId: id,
        normalizedCompany,
        questionCount: presetQuestions.length
      });
  
      const results = await Promise.all(
        presetQuestions.map(async (question) => {
          console.log(`Generating analysis for ${question.id}`);
          const response = await analyzeWithPrompt(question.prompt, question.id, false);
          return {
            questionId: question.id,
            analysis: {
              content: response.analysis,
              generatedAt: response.generatedAt,
              fileCount: response.fileCount,
              normalizedCompany
            } as Analysis
          };
        })
      );
  
      const newResults = results.reduce<AnalysisResults>(
        (acc, { questionId, analysis }) => ({
          ...acc,
          [questionId]: analysis
        }),
        {}
      );
  
      console.log('All analyses generated successfully:', {
        count: Object.keys(newResults).length,
        projectId: id,
        normalizedCompany
      });
  
      setAnalysisResults(newResults);
    } catch (error) {
      console.error('Failed to generate analyses:', {
        error,
        projectId: id,
        normalizedCompany
      });
      throw error;
    }
  };

  useEffect(() => {
    if (id) {
      console.log('Initial load - fetching analyses for project:', id);
      fetchCachedAnalyses();
    }
  }, [id]);


  // Debug effect for analysis state changes
  useEffect(() => {
    const questionIds = Object.keys(analysisResults);
    if (questionIds.length > 0) {
      console.log('📊 Current analysis results:', {
        count: questionIds.length,
        questionIds,
        samples: Object.entries(analysisResults).map(([questionId, value]) => ({
          questionId,
          hasContent: !!value?.content,
          contentPreview: value?.content?.substring(0, 50) ?? 'No content'
        }))
      });
    }
  }, [analysisResults]);


  const handleBack = () => {
    if (!user?.email || !id) return;
    const companyName = getCompanyFromEmail(user.email);
    navigate(`/companies/${companyName}/projects/${id}`);
  };

  const handleForceRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      await generateAllAnalyses();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to analyze project');
    } finally {
      setIsRegenerating(false);
    }
  };


  const handleCustomAnalysis = async () => {
    if (!user?.email || !customPrompt.trim()) {
      setError('Please enter a question');
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    const normalizedCompany = getCompanyFromEmail(user.email);
    
    try {
      console.log('Starting custom analysis:', {
        projectId: id,
        normalizedCompany,
        promptLength: customPrompt.length
      });
  
      const result = await analyzeWithPrompt(customPrompt, 'custom', true);
      
      setAnalysisResults(prev => ({
        ...prev,
        custom: {
          content: result.analysis,
          generatedAt: result.generatedAt,
          fileCount: result.fileCount,
          normalizedCompany
        }
      }));
    } catch (error) {
      console.error('Custom analysis failed:', {
        error,
        projectId: id,
        normalizedCompany
      });
      setError(error instanceof Error ? error.message : 'Failed to analyze project');
    } finally {
      setIsAnalyzing(false);
    }
  };



// Add this debug log in the render
const renderAnalyses = () => {
  return (
    <Accordion type="single" collapsible className="w-full">
      {presetQuestions.map((question) => {
        const analysis = analysisResults[question.id];
        
        console.log(`🔍 Rendering ${question.id}:`, {
          hasAnalysis: !!analysis,
          hasContent: !!analysis?.content,
          contentLength: analysis?.content?.length ?? 0
        });
        
        return (
          <AccordionItem key={question.id} value={question.id}>
            <AccordionTrigger>
              <div className="flex justify-between w-full">
                <span>{question.label}</span>
                {analysis?.generatedAt && (
                  <span className="text-xs text-muted-foreground">
                    Generated: {new Date(analysis.generatedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="whitespace-pre-wrap bg-muted p-4 rounded-md">
                {analysis?.content || 'No analysis available'}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

  const analysisContent = (
    <Card className="max-w-4xl mx-auto mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Button>
        </div>
        <CardTitle>RFP Analysis</CardTitle>
        <Button
      variant="outline"
      size="sm"
      onClick={handleForceRegenerate}
      disabled={isRegenerating}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
      {isRegenerating ? 'Regenerating...' : 'Regenerate'}
    </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="preset">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preset">AI Analysis</TabsTrigger>
            <TabsTrigger value="custom">Custom Query</TabsTrigger>
          </TabsList>

          <TabsContent value="preset">
  {isLoading ? (
    <div className="flex justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {presetQuestions.map((question) => (
                  <AccordionItem key={question.id} value={question.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between w-full">
                        <span>{question.label}</span>
                        {analysisResults[question.id] && (
                          <span className="text-xs text-muted-foreground">
                            Generated: {new Date(analysisResults[question.id].generatedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="whitespace-pre-wrap bg-muted p-4 rounded-md">
                        {analysisResults[question.id]?.content}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <Textarea
              placeholder="Ask any question about the RFP..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            <Button
              onClick={handleCustomAnalysis}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Ask Question'
              )}
            </Button>
            {analysisResults.custom && (
              <div className="whitespace-pre-wrap bg-muted p-4 rounded-md mt-4">
                {analysisResults.custom.content}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  return <DashboardLayout>{analysisContent}</DashboardLayout>;
};

export default ProjectAnalysis;