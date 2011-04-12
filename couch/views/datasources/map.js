function(doc) {
  if (doc.type.indexOf("/type/datasource") >= 0 && doc.public) {
    emit(doc._id, doc);
  }
}