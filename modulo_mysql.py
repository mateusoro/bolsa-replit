import mysql.connector
import time
from threading import Thread


def conectar():
    global mycursor
    global mydb
    mydb = mysql.connector.connect(
        host="sql434.main-hosting.eu",
        user="u888071488_root",
        password="Ss161514",
        database="u888071488_stremio_db"
    )
    mycursor = mydb.cursor()
    while(True):
        time.sleep(10)  
        try: 
            if not mydb.is_connected():
                print('Conectando')
                mydb = mysql.connector.connect(
                    host="sql434.main-hosting.eu",
                    user="u888071488_root",
                    password="Ss161514",
                    database="u888071488_stremio_db"
                )                
                mycursor = mydb.cursor()
        except Exception as e:
            print('Erro conectando')

def select(sql):   
    global mycursor 
    global mydb      
    if not mydb.is_connected():
        print('Esperando conexão')
        time.sleep(2)
        return select(sql)
    else:
        try:
            
            mycursor.execute(sql) 
            if "delete" in sql:
                mydb.commit()
                return ""
            else:
                myresult = mycursor.fetchall()
                mydb.commit()
                return myresult
        except Exception as e:
            #print(e)
            if "No result set to fetch from" in str(e):
                return []
            else:
                print(str(e))
                print(sql)
                print('Esperando conexão')
                time.sleep(2)
                return select(sql)

t1 = Thread(target=conectar,args=[])
t1.start()
