from langchain_openai import ChatOpenAI, OpenAIEmbeddings
import httpx
from datetime import datetime, timedelta
import uuid

client = httpx.Client(verify=False)

# DON'T EDIT THIS FILE - COPY to your local and start working

llm = ChatOpenAI(
    base_url="https://genailab.tcs.in",
    model="azure/genailab-maas-gpt-4.1",
    api_key="sk-irQRPPSRcogLdyg-S0wJRg", # Replace with your actual API key
    http_client=client
)

embedding_model = OpenAIEmbeddings(
    base_url="https://genailab.tcs.in", 
    model="azure/genailab-maas-gpt-4o",
    api_key='sk-irQRPPSRcogLdyg-S0wJRg', # Replace with your actual API key
    http_client=client
)

print(llm.invoke("Hi").content)
