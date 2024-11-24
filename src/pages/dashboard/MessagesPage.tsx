import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  where,
  getDocs
} from 'firebase/firestore';
import { 
  UserPlus, 
  Search, 
  Send, 
  Plus, 
  ArrowLeft,
  FileText,
  Users,
  Filter,
  Paperclip
} from 'lucide-react';
import { db, auth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import DashboardLayout from '@/components/layout/DashboardLayout';

interface Message {
  id: string;
  text: string;
  sender: string;
  senderName: string;
  timestamp: any;
  proposalId?: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

interface Chat {
  id: string;
  name: string;
  proposalId?: string;
  lastMessage?: string;
  timestamp: any;
  type: 'direct' | 'proposal';
  participants: string[];
  organizationId: string;
}

interface Proposal {
  id: string;
  title: string;
  status: 'draft' | 'review' | 'submitted';
  dueDate: Date;
  client: string;
}

const MessagesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<'all' | 'direct' | 'proposal'>('all');
  const [newChatType, setNewChatType] = useState<'direct' | 'proposal'>('direct');


  const handleSendMessage = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedChat || !auth.currentUser) return;

    try {
      console.log('Attempting to send message:', newMessage);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/signin');
      return;
    }

    // Fetch user's organization ID
    const fetchUserOrg = async () => {
      const userSnap = await getDocs(
        query(collection(db, 'users'), 
        where('uid', '==', auth.currentUser?.uid))
      );
      const userData = userSnap.docs[0]?.data();
      return userData?.organizationId;
    };

  


    // Fetch chats and proposals
    const initializeData = async () => {
      const orgId = await fetchUserOrg();
      
      // Fetch chats
      const chatsRef = collection(db, 'chats');
      const chatsQuery = query(
        chatsRef,
        where('participants', 'array-contains', auth.currentUser?.uid),
        where('organizationId', '==', orgId),
        orderBy('timestamp', 'desc')
      );

      const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
        const chatsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Chat));
        setChats(chatsList);
      });

      // Fetch proposals
      const proposalsRef = collection(db, 'proposals');
      const proposalsQuery = query(
        proposalsRef,
        where('organizationId', '==', orgId),
        orderBy('dueDate', 'desc')
      );

      const unsubProposals = onSnapshot(proposalsQuery, (snapshot) => {
        const proposalsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Proposal));
        setProposals(proposalsList);
      });

      return () => {
        unsubChats();
        unsubProposals();
      };
    };

    initializeData();
  }, [navigate]);

  const createNewChat = async (participants: string[], proposalId?: string | null) => {
    if (!auth.currentUser) return;

    try {
      const userSnap = await getDocs(
        query(collection(db, 'users'), 
        where('uid', '==', auth.currentUser.uid))
      );
      const userData = userSnap.docs[0]?.data();

      const chatData = {
        participants: [auth.currentUser.uid, ...participants],
        type: proposalId ? 'proposal' : 'direct',
        proposalId: proposalId || undefined, // Convert null to undefined
        organizationId: userData?.organizationId,
        timestamp: serverTimestamp(),
        name: proposalId 
          ? proposals.find(p => p.id === proposalId)?.title || 'New Proposal Chat'
          : 'New Chat'
      };

      const chatRef = await addDoc(collection(db, 'chats'), chatData);
      setSelectedChat(chatRef.id);
      setIsNewChatOpen(false);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  return (
    <DashboardLayout>

    <div className="h-[calc(100vh-theme(spacing.16))] bg-white rounded-lg shadow">
      <div className="flex h-full">
        {/* Left Sidebar */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/dashboard')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">Messages</h2>
              </div>
              <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>New Conversation</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="direct" onValueChange={(v) => setNewChatType(v as 'direct' | 'proposal')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="direct">Direct Message</TabsTrigger>
                      <TabsTrigger value="proposal">Proposal Chat</TabsTrigger>
                    </TabsList>
                    <TabsContent value="direct" className="mt-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Select Participants</label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose team members" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="team1">Team Member 1</SelectItem>
                            <SelectItem value="team2">Team Member 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                    <TabsContent value="proposal" className="mt-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Select Proposal</label>
                        <Select onValueChange={setSelectedProposal}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a proposal" />
                          </SelectTrigger>
                          <SelectContent>
                            {proposals.map(proposal => (
                              <SelectItem key={proposal.id} value={proposal.id}>
                                <div className="flex items-center">
                                  <FileText className="h-4 w-4 mr-2" />
                                  {proposal.title}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Add Subcontractors</label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select subcontractors" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sub1">Subcontractor 1</SelectItem>
                            <SelectItem value="sub2">Subcontractor 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <DialogFooter className="mt-6">
                    <Button onClick={() => createNewChat([], selectedProposal)}>
                      Create Chat
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {/* Search and Filter */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search messages"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={chatFilter} onValueChange={(v) => setChatFilter(v as typeof chatFilter)}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <span>Filter</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chats</SelectItem>
                  <SelectItem value="direct">Direct Messages</SelectItem>
                  <SelectItem value="proposal">Proposal Chats</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
  
          {/* Chat List */}
          <div className="overflow-y-auto flex-1">
            {chats
              .filter(chat => {
                const matchesSearch = chat.name?.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesFilter = chatFilter === 'all' || chat.type === chatFilter;
                return matchesSearch && matchesFilter;
              })
              .map(chat => (
                <Button
                  key={chat.id}
                  variant="ghost"
                  className={`w-full justify-start p-4 h-auto ${
                    selectedChat === chat.id ? 'bg-primary-50' : ''
                  }`}
                  onClick={() => setSelectedChat(chat.id)}
                >
                  <div className="flex items-start w-full gap-3">
                    {chat.type === 'proposal' ? (
                      <FileText className="h-5 w-5 text-primary-500 mt-1" />
                    ) : (
                      <Users className="h-5 w-5 text-gray-500 mt-1" />
                    )}
                    <div className="flex flex-col items-start min-w-0">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium truncate">{chat.name}</span>
                        <span className="text-xs text-gray-500">
                          {chat.timestamp?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500 truncate w-full">
                        {chat.lastMessage || 'No messages yet'}
                      </span>
                    </div>
                  </div>
                </Button>
              ))}
          </div>
        </div>
  
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-medium">
                      {chats.find(chat => chat.id === selectedChat)?.name}
                    </h3>
                    {chats.find(chat => chat.id === selectedChat)?.type === 'proposal' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/proposals/${chats.find(chat => chat.id === selectedChat)?.proposalId}`)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Proposal
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Paperclip className="h-4 w-4 mr-2" />
                      Files
                    </Button>
                    <Button variant="outline" size="sm">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add People
                    </Button>
                  </div>
                </div>
              </div>
  
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === auth.currentUser?.uid
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.sender === auth.currentUser?.uid
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {message.sender === auth.currentUser?.uid ? 'You' : message.senderName}
                        </span>
                        <span className="text-xs opacity-75">
                          {message.timestamp?.toDate()?.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.attachments.map((attachment, index) => (
                            <div 
                              key={index} 
                              className={`flex items-center gap-2 ${
                                message.sender === auth.currentUser?.uid
                                  ? 'text-white'
                                  : 'text-primary-600'
                              }`}
                            >
                              <Paperclip className="h-4 w-4" />
                              <a 
                                href={attachment.url}
                                className="text-sm underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {attachment.name}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
  
              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1"
                  />
                  <Button variant="outline" type="button">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button type="submit">
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </form>
            </>
          ) : (
            // Empty State
            <div className="flex-1 flex items-center justify-center">
              <Card className="w-96">
                <CardHeader>
                  <CardTitle>No chat selected</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 mb-4">
                    Select a conversation from the sidebar or start a new one to collaborate on proposals with your team and subcontractors.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => setIsNewChatOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Conversation
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>

  );
};
export default MessagesPage;

